#!/usr/bin/env node
/**
 * Simulated-shopper traffic for techstore.win.
 *
 * Drives real Chromium sessions so the Catchpoint RUM tag records genuine page views, soft
 * navigations, conversions, errors, bounces and frustration signals. Every session is a new
 * visitor (fresh browser context). The RUM tracepoint `trafficsrc` reports these as "automation".
 *
 * Usage:
 *   node scripts/traffic.mjs                       # ~1000 page views, 5 parallel browsers
 *   node scripts/traffic.mjs --pageviews 300 --concurrency 3
 *   node scripts/traffic.mjs --trickle 20          # keep going: ~20 sessions every 15 minutes
 *   node scripts/traffic.mjs --pin-dns             # bypass a stale local DNS cache for *.techstore.win
 *   node scripts/traffic.mjs --journey buy --scenario stalled_order --pageviews 10   # one specific case
 */
import { chromium, devices } from "@playwright/test";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]] : acc), []),
);
const BASE = args.base ?? "https://techstore.win";
const TARGET = Number(args.pageviews ?? 1000);
const CONCURRENCY = Number(args.concurrency ?? 5);
const TRICKLE = args.trickle ? Number(args.trickle) : 0;
const WORKSPACE = args.workspace ?? "shoppers";

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const think = (page, min = 0.8, max = 4) => page.waitForTimeout(rand(min, max) * 1000);
function weighted(table) {
  const total = table.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [w, v] of table) if ((r -= w) <= 0) return v;
  return table[0][1];
}

const DESKTOP_UA = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];
const DEVICE_PROFILES = [
  [55, () => ({ viewport: pick([{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1366, height: 768 }]), userAgent: pick(DESKTOP_UA), label: "desktop" })],
  [30, () => ({ ...devices[pick(["Pixel 7", "Galaxy S9+", "Pixel 5"])], label: "mobile" })],
  [15, () => ({ ...devices[pick(["Galaxy Tab S4", "iPad Mini"])], label: "tablet" })],
];

const TELECOM = ["fiber-1g", "fiber-300m", "biz-2g", "backup-5g"];
const RETAIL = ["studiobook-14", "aero-anc", "dockone-hub", "wifi7-mesh"];
const POSTCODES = ["94105", "10001", "EC2A 4NE", "SW1A 1AA", "M1 1AE", "560001", "110001", "400001", "2000", "10115", "75001", "1010"];

// ------------------------------------------------------------------ journeys

async function landHome(page, s) {
  await page.goto(`${BASE}/?workspace=${WORKSPACE}&scenario=${s.scenario}&profile=${s.profile}`, { waitUntil: "load" });
  await page.getByTestId("hero-title").waitFor({ timeout: 20000 });
  await think(page, 1, 3);
}

async function scroll(page) {
  for (let i = 0; i < Math.floor(rand(1, 4)); i++) {
    await page.mouse.wheel(0, rand(300, 900));
    await think(page, 0.4, 1.5);
  }
}

async function browseCatalog(page, s) {
  await page.getByTestId("nav-catalog").first().click().catch(() => page.goto(`${BASE}/catalog`));
  await page.getByTestId("catalog-grid").and(page.locator('[data-state="success"]')).waitFor({ timeout: 20000 });
  await think(page);
  if (chance(0.5)) {
    const filters = await page.locator('[data-testid^="filter-"]').all();
    if (filters.length) await pick(filters).click();
    await think(page, 1, 2.5);
  }
  if (chance(0.25)) {
    await page.getByTestId("select-sort").selectOption(pick(["price-asc", "price-desc", "rating"]));
    await think(page, 0.8, 2);
  }
  await scroll(page);
}

async function openProduct(page, s, slug) {
  slug ??= pick(s.profile === "retail" ? RETAIL : TELECOM);
  const card = page.getByTestId(`btn-configure-${slug}`);
  if (await card.count()) await card.first().click();
  else await page.goto(`${BASE}/product/${slug}`);
  await page.getByTestId("product-detail").waitFor({ timeout: 25000 });
  await think(page, 1.5, 4);
  if (chance(0.5)) await page.locator('[data-testid^="variant-"]').last().click();
  if (chance(0.35)) await page.locator('[data-testid^="addon-"]').first().check();
  return slug;
}

async function checkAvailability(page, unavailable = false) {
  // Frustration signal: some users hammer the disabled Add to basket button first.
  if (chance(0.12)) for (let i = 0; i < 5; i++) await page.getByTestId("btn-add-to-basket").click({ force: true, timeout: 2000 }).catch(() => {});
  await page.getByTestId("input-postcode").first().fill(unavailable ? `000${Math.floor(rand(10, 99))}` : pick(POSTCODES));
  await think(page, 0.5, 1.5);
  await page.getByTestId("btn-check-availability").first().click();
  await page.locator('[data-testid="availability-result"], [data-testid="availability-error"]').first().waitFor({ timeout: 25000 });
  await think(page, 1, 3);
  return (await page.getByTestId("availability-result").first().getAttribute("data-available").catch(() => null)) === "true";
}

async function addToBasket(page) {
  if (chance(0.25)) await page.getByTestId("btn-qty-increase").click();
  await page.getByTestId("btn-add-to-basket").click();
  await page.getByTestId("added-to-basket").waitFor();
  await think(page, 0.8, 2);
}

async function goBasket(page, s) {
  await page.getByTestId("nav-basket").click();
  await page.getByTestId("basket-lines").waitFor({ timeout: 15000 });
  await think(page, 1, 3);
  if (chance(0.2)) {
    await page.getByTestId("btn-increase-0").click();
    await think(page, 0.5, 1.5);
  }
  if (s.promo) {
    await page.getByTestId("input-promo").fill(s.promo);
    await page.getByTestId("btn-apply-promo").click();
    await think(page, 1, 2);
  }
}

async function checkout(page, { fill = true, retries = 0 } = {}) {
  await page.getByTestId("btn-proceed-checkout").click();
  await page.getByTestId("checkout-form").waitFor();
  await think(page, 2, 5);
  if (!fill) {
    // Validation failure: submit an empty form.
    await page.getByTestId("btn-place-order").click();
    await think(page, 2, 4);
    return "validation";
  }
  if (chance(0.15)) {
    await page.getByTestId("input-fullname").fill("Sam Taylor");
    await page.getByTestId("input-email").fill("sam.taylor@example.com");
    await think(page, 2, 5);
  }
  await page.getByTestId("btn-fill-demo-customer").click();
  await think(page, 1.5, 4);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const btn = attempt === 0 ? page.getByTestId("btn-place-order") : page.getByTestId("btn-retry-order");
    await btn.click();
    const outcome = await Promise.race([
      page.waitForURL(/\/orders\/NX-/, { timeout: 30000 }).then(() => "success"),
      page.getByTestId("checkout-error").waitFor({ timeout: 30000 }).then(() => "failed"),
    ]).catch(() => "timeout");
    if (outcome === "success") return "success";
    await think(page, 2, 5);
  }
  return "failed";
}

async function watchOrder(page, seconds) {
  await page.getByTestId("order-detail").waitFor({ timeout: 15000 });
  await page.waitForTimeout(seconds * 1000);
}

const JOURNEYS = {
  /** Lands and leaves. */
  async bounce(page, s) {
    if (chance(0.35)) {
      await page.goto(`${BASE}/product/${pick(s.profile === "retail" ? RETAIL : TELECOM)}?workspace=${WORKSPACE}&scenario=${s.scenario}&profile=${s.profile}&utm_source=ads`, { waitUntil: "load" });
      await page.getByTestId("product-detail").waitFor({ timeout: 25000 }).catch(() => {});
    } else await landHome(page, s);
    if (chance(0.5)) await scroll(page);
    await think(page, 2, 8);
  },
  /** Window shopper: catalog and a product or two. */
  async browse(page, s) {
    await landHome(page, s);
    await scroll(page);
    await browseCatalog(page, s);
    await openProduct(page, s);
    if (chance(0.5)) {
      await page.goBack();
      await think(page);
      await openProduct(page, s);
    }
  },
  /** Checks coverage, sometimes not available, then leaves. */
  async availability(page, s) {
    await landHome(page, s);
    if (chance(0.4)) {
      await page.getByTestId("input-postcode").first().fill(pick(POSTCODES));
      await page.getByTestId("btn-check-availability").first().click();
      await page.locator('[data-testid="availability-result"]').first().waitFor({ timeout: 25000 });
      await think(page, 2, 4);
    }
    await browseCatalog(page, s);
    await openProduct(page, s);
    await checkAvailability(page, chance(0.35));
  },
  /** Adds to basket, then abandons. */
  async cartAbandon(page, s) {
    await landHome(page, s);
    await browseCatalog(page, s);
    await openProduct(page, s);
    if (!(await checkAvailability(page))) return;
    await addToBasket(page);
    await goBasket(page, s);
    if (chance(0.3)) await page.getByTestId("btn-remove-0").click();
    await think(page, 2, 6);
  },
  /** Reaches checkout, then abandons (sometimes after a validation error). */
  async checkoutAbandon(page, s) {
    await landHome(page, s);
    await openProduct(page, s);
    if (!(await checkAvailability(page))) return;
    await addToBasket(page);
    await goBasket(page, s);
    await checkout(page, { fill: false });
    await think(page, 3, 8);
  },
  /** Full purchase, then watches the order tracker. */
  async buy(page, s) {
    await landHome(page, s);
    if (chance(0.6)) await browseCatalog(page, s);
    await openProduct(page, s);
    if (!(await checkAvailability(page))) return;
    await addToBasket(page);
    if (chance(0.2)) {
      await page.getByTestId("nav-catalog").first().click();
      await openProduct(page, s);
      await checkAvailability(page);
      await addToBasket(page);
    }
    await goBasket(page, s);
    const result = await checkout(page, { retries: s.scenario === "checkout_failure" ? 1 : 0 });
    if (result === "success") await watchOrder(page, rand(6, s.scenario === "stalled_order" ? 22 : 24));
    else await think(page, 3, 8);
  },
  /** Returning customer tracking an existing order. */
  async trackOrder(page, s) {
    await landHome(page, s);
    await page.getByTestId("nav-orders").first().click().catch(() => page.goto(`${BASE}/orders`));
    await page.getByTestId("order-lookup-form").waitFor();
    await think(page, 1, 3);
    await page.getByTestId("link-demo-order").click();
    await page.getByTestId("order-detail").waitFor({ timeout: 15000 }).catch(() => {});
    await think(page, 3, 8);
  },
  /** Hits the BROKEN50 promo (uncaught TypeError). */
  async jsError(page, s) {
    await landHome(page, s);
    await openProduct(page, s);
    if (!(await checkAvailability(page))) return;
    await addToBasket(page);
    await goBasket(page, { ...s, promo: "BROKEN50" });
    await think(page, 2, 5);
    if (chance(0.5)) await checkout(page);
  },
  /** Lost visitor: broken link → 404 → recovers or leaves. */
  async notFound(page, s) {
    await page.goto(`${BASE}/${pick(["offers", "broadband-deals", "product/fiber-10g", "help/router"])}?workspace=${WORKSPACE}&scenario=${s.scenario}&profile=${s.profile}`, { waitUntil: "load" });
    await think(page, 2, 5);
    if (chance(0.5)) {
      await page.getByRole("link", { name: "Back to Nexora" }).click().catch(() => {});
      await think(page, 2, 5);
    }
  },
};

const JOURNEY_MIX = [
  [24, "bounce"],
  [18, "browse"],
  [12, "availability"],
  [12, "cartAbandon"],
  [8, "checkoutAbandon"],
  [18, "buy"],
  [3, "trackOrder"],
  [3, "jsError"],
  [2, "notFound"],
];

// --mix "bounce:60,browse:20,buy:5" overrides the journey weights for this run.
const MIX = typeof args.mix === "string"
  ? args.mix.split(",").map((p) => p.split(":")).map(([j, w]) => [Number(w), j.trim()]).filter(([w, j]) => w > 0 && JOURNEY_MIX.some(([, k]) => k === j))
  : JOURNEY_MIX;

function makeSession() {
  const journey = args.journey ?? weighted(MIX);
  // Scenario mix: mostly healthy. Faults are pinned per session only (never changes the shared workspace).
  const scenario = args.scenario ??
    (journey === "buy"
      ? weighted([[62, "healthy"], [14, "slow_experience"], [14, "checkout_failure"], [10, "stalled_order"]])
      : weighted([[80, "healthy"], [20, "slow_experience"]]));
  return {
    journey,
    scenario,
    profile: chance(0.68) ? "telecom" : "retail",
    promo: chance(0.3) ? "WELCOME10" : chance(0.06) ? "SPRING25" : undefined,
    device: weighted(DEVICE_PROFILES)(),
  };
}

// ------------------------------------------------------------------ runner

const stats = { sessions: 0, pageviews: 0, failedSessions: 0, byJourney: {}, outcomes: { orders: 0, paymentFailures: 0, jsErrors: 0 } };

async function runSession(browser) {
  const s = makeSession();
  const { label, ...deviceOpts } = s.device;
  const context = await browser.newContext({ ...deviceOpts, locale: pick(["en-GB", "en-US", "en-IN"]) });
  const page = await context.newPage();
  let views = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) views++;
  });
  page.on("pageerror", () => stats.outcomes.jsErrors++);
  page.on("response", (r) => {
    if (r.url().endsWith("/api/orders") && r.request().method() === "POST") {
      if (r.status() === 200) stats.outcomes.orders++;
      else if (r.status() === 502) stats.outcomes.paymentFailures++;
    }
  });
  page.setDefaultTimeout(20000);
  try {
    await JOURNEYS[s.journey](page, s);
  } catch (err) {
    stats.failedSessions++;
    if (args.verbose) console.error(`[${s.journey}/${s.scenario}/${s.profile}/${label}]`, err.message.split("\n")[0]);
  }
  // Leave the page so the RUM agent flushes its pagehide beacon.
  await page.close({ runBeforeUnload: true }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  await context.close().catch(() => {});
  stats.sessions++;
  stats.pageviews += views;
  stats.byJourney[s.journey] = (stats.byJourney[s.journey] ?? 0) + 1;
}

function report(prefix = "") {
  console.log(
    `${prefix}sessions=${stats.sessions} pageviews≈${stats.pageviews} orders=${stats.outcomes.orders} paymentFailures=${stats.outcomes.paymentFailures} jsErrors=${stats.outcomes.jsErrors} errors=${stats.failedSessions} | ${Object.entries(stats.byJourney)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ")}`,
  );
}

async function burst(browser, { pageviews, sessions }) {
  const startViews = stats.pageviews;
  const startSessions = stats.sessions;
  const done = () => (sessions ? stats.sessions - startSessions >= sessions : stats.pageviews - startViews >= pageviews);
  const worker = async () => {
    while (!done()) {
      await runSession(browser);
      if (stats.sessions % 10 === 0) report(`[${new Date().toLocaleTimeString()}] `);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// --pin-dns: resolve *.techstore.win via Cloudflare's edge IP, bypassing a stale local DNS cache.
const browser = await chromium.launch(args["pin-dns"] ? { args: ["--host-resolver-rules=MAP *.techstore.win 104.21.96.65"] } : {});
console.log(`Simulating shoppers on ${BASE} (workspace=${WORKSPACE}, concurrency=${CONCURRENCY})`);
await burst(browser, { pageviews: TARGET });
report("Burst complete: ");
if (TRICKLE) {
  console.log(`Trickle mode: ~${TRICKLE} sessions every 15 minutes. Ctrl+C to stop.`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 15 * 60_000));
    await burst(browser, { sessions: TRICKLE });
    report(`[${new Date().toLocaleTimeString()}] trickle: `);
  }
}
await browser.close();
