import { expect, test } from "@playwright/test";
import { addProductToBasket, checkout, uniqueWorkspace } from "./helpers";

test("healthy: browse, check availability, basket, checkout, live order completion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?workspace=${uniqueWorkspace("healthy")}&scenario=healthy`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await expect(page.getByTestId("featured-grid")).toHaveAttribute("data-state", "success");

  await page.getByTestId("nav-catalog").click();
  await expect(page.getByTestId("catalog-grid")).toHaveAttribute("data-state", "success");
  await page.getByTestId("filter-business").click();
  await expect(page.getByTestId("catalog-grid")).toHaveAttribute("data-count", "1");
  await page.getByTestId("filter-all").click();
  await expect(page.getByTestId("catalog-grid")).toHaveAttribute("data-count", "4");
  await page.getByTestId("btn-configure-fiber-1g").click();
  await expect(page).toHaveURL(/\/product\/fiber-1g$/);

  await addProductToBasket(page, "fiber-1g");
  await page.getByTestId("btn-view-basket").click();
  await expect(page.getByTestId("basket-count")).toHaveText("1");
  await page.getByTestId("btn-increase-0").click();
  await expect(page.getByTestId("qty-0")).toHaveText("2");
  await page.getByTestId("input-promo").fill("WELCOME10");
  await page.getByTestId("btn-apply-promo").click();
  await expect(page.getByTestId("basket-discount")).toBeVisible();

  const res = await checkout(page);
  expect(res.status()).toBe(200);
  await expect(page).toHaveURL(/\/orders\/NX-\d{4}-\d{4}\?placed=1/);
  await expect(page.getByTestId("order-confirmation")).toBeVisible();
  await expect(page.getByTestId("milestone-1")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("order-detail")).toHaveAttribute("data-status", "completed", { timeout: 40_000 });
  await expect(page.getByTestId("milestone-6")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("milestone-6")).toContainText("Service active");

  // Basket is cleared and the order shows up under "orders placed on this device".
  await page.getByTestId("nav-orders").click();
  await expect(page.getByTestId("recent-orders")).toContainText("Completed");
  expect(errors).toEqual([]);
});

test("profile switching updates catalog, checkout fields and milestones", async ({ page }) => {
  await page.goto(`/ops/scenarios?workspace=${uniqueWorkspace("profile")}`);
  await page.getByTestId("btn-profile-retail").click();
  await expect(page.getByTestId("btn-profile-retail")).toHaveAttribute("aria-checked", "true");

  await page.goto("/catalog");
  await expect(page.getByTestId("product-card-studiobook-14")).toBeVisible();
  await expect(page.getByTestId("product-card-fiber-1g")).toHaveCount(0);

  await addProductToBasket(page, "aero-anc", "560001");
  await page.getByTestId("nav-basket").click();
  await page.getByTestId("btn-proceed-checkout").click();
  await expect(page.getByTestId("tax-invoice-section")).toBeVisible();
  await expect(page.getByTestId("slot-next-day")).toContainText("Next-Day Express");
  await page.getByTestId("btn-fill-demo-customer").click();
  await page.getByTestId("btn-place-order").click();
  await expect(page.getByTestId("milestone-3")).toContainText("Warehouse stock reserved");
  await expect(page.getByTestId("milestone-6")).toContainText("Delivered");

  await page.goto("/ops/scenarios");
  await page.getByTestId("btn-profile-telecom").click();
  await expect(page.getByTestId("btn-profile-telecom")).toHaveAttribute("aria-checked", "true");
  await page.goto("/catalog");
  await expect(page.getByTestId("product-card-fiber-1g")).toBeVisible();
  await expect(page.getByTestId("product-card-studiobook-14")).toHaveCount(0);
  await page.goto("/product/fiber-300m");
  await expect(page.getByTestId("product-name")).toHaveText("Nexora Fiber 300 Mbps");
});

test("slow_experience adds measurable delay but the journey completes", async ({ page }) => {
  await page.goto(`/?workspace=${uniqueWorkspace("slow")}&scenario=slow_experience`);
  await expect(page.locator('script[data-testid="third-party-analytics"]')).toHaveCount(1);
  await expect(page.getByTestId("featured-grid")).toHaveAttribute("data-state", "success", { timeout: 20_000 });

  await page.goto("/product/fiber-300m");
  await expect(page.getByTestId("product-detail")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("input-postcode").fill("94105");
  const started = Date.now();
  await page.getByTestId("btn-check-availability").click();
  await expect(page.getByTestId("availability-result")).toBeVisible({ timeout: 20_000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(2700);
  const timing = await page.evaluate(() => performance.getEntriesByName("nexora:availability-check")[0]?.duration ?? 0);
  expect(timing).toBeGreaterThanOrEqual(2700);

  await page.getByTestId("btn-add-to-basket").click();
  const res = await checkout(page);
  expect(res.status()).toBe(200);
  await expect(page.getByTestId("order-confirmation")).toBeVisible();
});

test("checkout_failure surfaces a clear payment failure", async ({ page }) => {
  await page.goto(`/?workspace=${uniqueWorkspace("fail")}&scenario=checkout_failure`);
  await addProductToBasket(page, "biz-2g");
  const res = await checkout(page);
  expect(res.status()).toBe(502);
  expect((await res.json()).error.code).toBe("PAYMENT_GATEWAY_TIMEOUT");
  const banner = page.getByTestId("checkout-error");
  await expect(banner).toHaveAttribute("data-code", "PAYMENT_GATEWAY_TIMEOUT");
  await expect(banner).toContainText("Upstream card processor timed out after 5000ms");
  await expect(page.getByTestId("btn-retry-order")).toBeVisible();
  await expect(page.getByTestId("btn-place-order")).toHaveAttribute("data-state", "error");
  await expect(page).toHaveURL(/\/checkout$/);
});

test("stalled_order: HTTP 200 checkout, stalls on a business rule, recovers via ops retry", async ({ page }) => {
  await page.goto(`/?workspace=${uniqueWorkspace("stall")}&scenario=stalled_order`);
  await addProductToBasket(page, "fiber-1g");
  const res = await checkout(page);
  expect(res.status()).toBe(200);
  const orderId: string = (await res.json()).order.id;

  await expect(page.getByTestId("order-confirmation")).toBeVisible();
  await expect(page.getByTestId("order-detail")).toHaveAttribute("data-status", "stalled", { timeout: 30_000 });
  await expect(page.getByTestId("milestone-stall-reason")).toBeVisible();
  const failed = page.locator('[data-testid^="milestone-"][data-state="failed"]');
  await expect(failed).toHaveCount(1);
  expect(["availability", "provisioning"]).toContain(await failed.getAttribute("data-milestone"));

  await page.goto(`/ops/orders?order=${orderId}`);
  const row = page.getByTestId(`ops-order-row-${orderId}`);
  await expect(row).toHaveAttribute("data-status", "stalled");
  await expect(page.getByTestId("ops-stall-panel")).toBeVisible();
  await expect(page.locator('[data-outcome="Blocked"]')).toHaveCount(1);
  await page.getByTestId("btn-retry-order-ops").click();
  await expect(row).toHaveAttribute("data-status", "completed", { timeout: 30_000 });
  await expect(page.locator('[data-outcome="Recovered"]')).toHaveCount(1);

  await page.getByTestId("ops-view-customer-tracker").click();
  await expect(page.getByTestId("order-detail")).toHaveAttribute("data-status", "completed");
});

test("BROKEN50 raises an uncaught client-side TypeError", async ({ page }) => {
  await page.goto(`/?workspace=${uniqueWorkspace("broken")}`);
  await addProductToBasket(page, "backup-5g");
  await page.getByTestId("nav-basket").click();
  const err = page.waitForEvent("pageerror");
  await page.getByTestId("input-promo").fill("BROKEN50");
  await page.getByTestId("btn-apply-promo").click();
  expect((await err).name).toBe("TypeError");
  await expect(page.getByTestId("basket-lines")).toBeVisible();
});

test("deep links work on hard load", async ({ page }) => {
  for (const path of ["/catalog", "/product/biz-2g", "/basket", "/orders", "/ops", "/ops/orders", "/ops/scenarios"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("#root > *").first()).toBeVisible();
  }
  const api = await page.request.get("/api/health");
  expect(api.headers()["server-timing"]).toContain("total");
  expect(api.headers()["x-nexora-service"]).toBe("storefront-edge");
});
