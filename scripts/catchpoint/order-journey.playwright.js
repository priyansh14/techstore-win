/* Catchpoint Playwright script: Nexora broadband order journey (techstore.win).
 * page, expect and Catchpoint are runtime globals. No credentials needed.
 *
 * Journey: Home -> Catalog -> Product -> Availability -> Basket -> Checkout -> Place order -> Order tracker.
 * Every run uses a fresh browser profile, so the basket always starts empty.
 *
 * WORKSPACE isolates synthetic orders from public visitors. Whatever scenario is active for this
 * workspace in https://techstore.win/ops/scenarios?workspace=techm drives the outcome:
 *   healthy           all 10 steps pass, order reaches "Service active"
 *   slow_experience   steps 1-4 slow (catalog/availability 2.8-3.8 s), journey still passes
 *   checkout_failure  fails at step 9 (payment gateway HTTP 502)
 *   stalled_order     fails at step 10 (HTTP 200, order blocked by a backend business rule)
 * A scenario scoped to "UK visitors only" fails only on UK nodes; other nodes pass in the same run.
 *
 * Waterfall: besides techstore.win, pages load fonts, product images (cdn.techstore.win) and
 * simulated vendors (tags., analytics., chat., reviews., ads.techstore.win). settle() lets each
 * page-load step finish its network activity so late requests are attributed to the right step.
 *
 * Catchpoint documents startStep(), not endStep(): the next startStep sets the next boundary.
 * Unnumbered checks inside a step do not create extra steps.
 */
const BASE = 'https://techstore.win';
const WORKSPACE = 'techm';
const PRODUCT = 'fiber-1g';          // Nexora Fiber 1 Gbps
const POSTCODE = 'SW1A 1AA';         // Serviceable postcode
const TIMEOUT = 30000;
page.setDefaultTimeout(TIMEOUT);
page.setDefaultNavigationTimeout(TIMEOUT);
await page.setViewportSize({ width: 1440, height: 1000 });

// Stable locators: every interactive element on the site carries a data-testid.
const t = id => page.getByTestId(id);

async function uniqueVisible(locator) {
  await expect(locator).toHaveCount(1, { timeout: TIMEOUT });
  await expect(locator).toBeVisible({ timeout: TIMEOUT });
  return locator;
}
async function clickUnique(locator) {
  await uniqueVisible(locator);
  await locator.click();
}
/** Waits for the network to go quiet (bounded), so late requests are attributed to the right step. */
async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}
async function fillUnique(locator, value) {
  await uniqueVisible(locator);
  await locator.fill(value);
}

await Catchpoint.startStep('1. Arrive on Homepage');
await page.goto(BASE + '/?workspace=' + WORKSPACE, { waitUntil: 'domcontentloaded' });
await uniqueVisible(t('hero-title'));
// Featured plans come from /api/catalog; wait until they have rendered.
await expect(t('featured-grid')).toHaveAttribute('data-state', 'success', { timeout: TIMEOUT });
// Let fonts, product images and third-party tags finish so they land in this step's waterfall.
await settle();

await Catchpoint.startStep('2. Open Catalog');
await clickUnique(t('nav-catalog'));
await expect(page).toHaveURL(BASE + '/catalog', { timeout: TIMEOUT });
await expect(t('catalog-grid')).toHaveAttribute('data-state', 'success', { timeout: TIMEOUT });
await uniqueVisible(t('product-card-' + PRODUCT));
await settle();

await Catchpoint.startStep('3. Select Product');
await clickUnique(t('btn-configure-' + PRODUCT));
await expect(page).toHaveURL(BASE + '/product/' + PRODUCT, { timeout: TIMEOUT });
await expect(t('product-detail')).toHaveAttribute('data-slug', PRODUCT, { timeout: TIMEOUT });
await expect(t('product-name')).toHaveText('Nexora Fiber 1 Gbps');
// Add to basket stays disabled until availability is confirmed.
await expect(t('btn-add-to-basket')).toBeDisabled();
await expect(t('recommendations')).toBeVisible({ timeout: TIMEOUT });
await settle();

await Catchpoint.startStep('4. Check Availability');
await fillUnique(t('input-postcode'), POSTCODE);
await clickUnique(t('btn-check-availability'));
await expect(t('availability-result')).toHaveAttribute('data-available', 'true', { timeout: TIMEOUT });
await expect(t('btn-add-to-basket')).toBeEnabled();

await Catchpoint.startStep('5. Add to Basket');
await clickUnique(t('btn-add-to-basket'));
await uniqueVisible(t('added-to-basket'));
await expect(t('basket-count')).toHaveText('1');

await Catchpoint.startStep('6. Open Basket');
await clickUnique(t('btn-view-basket'));
await expect(page).toHaveURL(BASE + '/basket', { timeout: TIMEOUT });
await expect(t('basket-line-0')).toHaveAttribute('data-slug', PRODUCT);
await expect(t('basket-lines').locator('[data-testid^="basket-line-"]')).toHaveCount(1);
await uniqueVisible(t('basket-total'));

await Catchpoint.startStep('7. Proceed to Checkout');
await clickUnique(t('btn-proceed-checkout'));
await expect(page).toHaveURL(BASE + '/checkout', { timeout: TIMEOUT });
await uniqueVisible(t('checkout-form'));
await expect(t('btn-place-order')).toBeEnabled();

await Catchpoint.startStep('8. Fill Customer Details');
await clickUnique(t('btn-fill-demo-customer'));
await expect(t('input-fullname')).not.toHaveValue('');
await expect(t('input-email')).not.toHaveValue('');
await expect(t('input-checkout-postcode')).not.toHaveValue('');
await expect(t('input-card-number')).toHaveValue('4242 4242 4242 4242');

await Catchpoint.startStep('9. Place Order');
await clickUnique(t('btn-place-order'));
// Either the tracker opens or the checkout shows an error banner (e.g. payment gateway 502).
const placed = await Promise.race([
  page.waitForURL(/\/orders\/NX-\d{4}-\d{4}\?placed=1$/, { timeout: TIMEOUT }).then(() => 'placed'),
  t('checkout-error').waitFor({ state: 'visible', timeout: TIMEOUT }).then(() => 'error'),
]);
if (placed === 'error') {
  const code = await t('checkout-error').getAttribute('data-code');
  const status = await t('checkout-error').getAttribute('data-status');
  throw new Error('Checkout failed: HTTP ' + status + ' ' + code);
}
await uniqueVisible(t('order-confirmation'));
const orderId = (await t('order-id').textContent()).trim();
expect(orderId).toMatch(/^NX-\d{4}-\d{4}$/);
await settle();

await Catchpoint.startStep('10. Track Order to Service Active');
await expect(t('milestone-1')).toHaveAttribute('data-state', 'done');
// Milestones advance about every 4 s; a healthy order completes in about 20 s.
await expect
  .poll(() => t('order-detail').getAttribute('data-status'), { timeout: 28000, intervals: [1000] })
  .not.toBe('in_progress');
const status = await t('order-detail').getAttribute('data-status');
if (status === 'stalled') {
  const milestone = (await t('order-current-milestone').textContent()).trim();
  const reason = (await t('milestone-stall-reason').textContent()).trim();
  throw new Error('Order ' + orderId + ' stalled at "' + milestone + '": ' + reason);
}
expect(status).toBe('completed');
await expect(t('milestone-6')).toHaveAttribute('data-state', 'done');
await uniqueVisible(t('order-completed-banner'));
