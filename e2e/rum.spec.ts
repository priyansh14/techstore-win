import { expect, test } from "@playwright/test";
import { addProductToBasket, checkout, uniqueWorkspace } from "./helpers";

/** Stub of the Catchpoint RUM agent that records every addInfo call. */
const STUB = `window.__rumCalls = []; window.RProfiler = { usePageHide: function () {}, addInfo: function () { window.__rumCalls.push(Array.prototype.slice.call(arguments)); } };`;

// These tests use a stub agent, so keep the real Catchpoint tag from loading over it.
test.beforeEach(async ({ page }) => {
  await page.route(/\.3gl\.net\//, (route) => route.abort());
});

const rumCalls = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __rumCalls: unknown[][] }).__rumCalls);

test("RUM bridge sends Catchpoint-valid tokens, context and a conversion", async ({ page }) => {
  await page.addInitScript(STUB);
  await page.goto(`/?workspace=${uniqueWorkspace("rum")}&scenario=healthy`);
  // The stub re-initialises on every hard load, so check the home page before leaving it.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __rumCalls: unknown[][] }).__rumCalls.some((c) => c[0] === "pageGroup" && c[1] === "home")))
    .toBe(true);
  await addProductToBasket(page, "fiber-1g");
  const res = await checkout(page);
  expect(res.status()).toBe(200);
  await expect(page.getByTestId("order-detail")).toBeVisible();
  await page.waitForTimeout(300);

  const calls: unknown[][] = await page.evaluate(() => (window as unknown as { __rumCalls: unknown[][] }).__rumCalls);
  const byKind = (k: string) => calls.filter((c) => c[0] === k);

  for (const [kind, token, value] of calls) {
    if (kind === "conversion") continue;
    expect(token, `${kind} token`).toMatch(/^[a-z0-9]{1,30}$/);
    if (kind === "tracepoint") expect(String(value).length).toBeLessThanOrEqual(32);
    if (kind === "indicator") expect(typeof value).toBe("number");
  }
  const groups = byKind("pageGroup").map((c) => c[1]);
  expect(groups).toEqual(expect.arrayContaining(["productdetail", "basket", "checkout", "ordertracker"]));
  expect(byKind("variation").map((c) => c[1])).toContain("telecom");
  const tps = Object.fromEntries(byKind("tracepoint").map((c) => [c[1], c[2]]));
  expect(tps).toMatchObject({ scenario: "healthy", trafficsrc: "automation", checkoutstep: "success" });
  expect(tps.workspace).toMatch(/^e2e-rum-/);
  expect(tps.orderid).toMatch(/^NX-\d{4}-\d{4}$/);
  const indicators = byKind("indicator").map((c) => c[1]);
  expect(indicators).toEqual(expect.arrayContaining(["availms", "checkoutms"]));
  // Only the Insights configured in Catchpoint are ever sent.
  const configured = ["scenario", "workspace", "orderid", "paymenterror", "checkoutstep", "trafficsrc", "availms", "checkoutms"];
  for (const [kind, token] of calls) if (kind === "tracepoint" || kind === "indicator") expect(configured).toContain(token);
  const conversions = byKind("conversion");
  expect(conversions).toHaveLength(1);
  expect(conversions[0][1]).toBeGreaterThan(0);
  expect(conversions[0][2]).toBe(1);
});

test("RUM calls made before the agent loads are flushed on GlimpseLoaded", async ({ page }) => {
  await page.goto(`/?workspace=${uniqueWorkspace("rumq")}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __nexoraRum: { pending: () => number } }).__nexoraRum.pending())).toBeGreaterThan(0);
  await page.evaluate(STUB + `window.dispatchEvent(new Event("GlimpseLoaded"));`);
  expect(await page.evaluate(() => (window as unknown as { __nexoraRum: { pending: () => number } }).__nexoraRum.pending())).toBe(0);
  const groups = await page.evaluate(() => (window as unknown as { __rumCalls: unknown[][] }).__rumCalls.filter((c) => c[0] === "pageGroup").map((c) => c[1]));
  expect(groups).toContain("home");
});

test("checkout failure is reported as a tracepoint and timed", async ({ page }) => {
  await page.addInitScript(STUB);
  await page.goto(`/?workspace=${uniqueWorkspace("rumfail")}&scenario=checkout_failure`);
  await addProductToBasket(page, "backup-5g");
  const res = await checkout(page);
  expect(res.status()).toBe(502);
  await expect(page.getByTestId("checkout-error")).toBeVisible();
  const calls = await rumCalls(page);
  const tps = Object.fromEntries(calls.filter((c) => c[0] === "tracepoint").map((c) => [c[1], c[2]]));
  expect(tps).toMatchObject({ checkoutstep: "failed", paymenterror: "502 PAYMENT_GATEWAY_TIMEOUT", scenario: "checkout_failure" });
  const checkoutMs = calls.find((c) => c[0] === "indicator" && c[1] === "checkoutms")?.[2] as number;
  expect(checkoutMs).toBeGreaterThanOrEqual(4900);
  expect(calls.filter((c) => c[0] === "conversion")).toHaveLength(0);
});
