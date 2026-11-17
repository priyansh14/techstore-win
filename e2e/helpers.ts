import { expect, type Page } from "@playwright/test";

export const uniqueWorkspace = (prefix: string) => `e2e-${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** Configure a product, pass the availability check and add it to the basket. */
export async function addProductToBasket(page: Page, slug: string, postcode = "94105") {
  await page.goto(`/product/${slug}`);
  await expect(page.getByTestId("product-detail")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("btn-add-to-basket")).toBeDisabled();
  await page.getByTestId("input-postcode").fill(postcode);
  await page.getByTestId("btn-check-availability").click();
  await expect(page.getByTestId("availability-result")).toHaveAttribute("data-available", "true", { timeout: 20_000 });
  await page.getByTestId("btn-add-to-basket").click();
  await expect(page.getByTestId("added-to-basket")).toBeVisible();
}

/** From a non-empty basket: fill the demo customer and place the order. Returns the POST /api/orders response. */
export async function checkout(page: Page) {
  await page.getByTestId("nav-basket").click();
  await page.getByTestId("btn-proceed-checkout").click();
  await page.getByTestId("btn-fill-demo-customer").click();
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/orders") && r.request().method() === "POST", { timeout: 30_000 }),
    page.getByTestId("btn-place-order").click(),
  ]);
  return response;
}
