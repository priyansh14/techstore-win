# Nexora: techstore-win

**Live:** https://techstore.win

Nexora is a fictional premium storefront that works like a real public website. It is built as a target for **synthetic transaction monitoring**, **API/waterfall analysis**, **Real User Monitoring (RUM)** and **backend order-progression observability**.

It ships with two switchable store profiles (Telecom fiber plans and Retail devices), a live 6-step order tracker, four repeatable fault scenarios and a presenter console.

## Architecture

```
Browser (React SPA)  ──►  Cloudflare Worker (worker/index.ts)
                           ├─ static assets (dist/client, served from the edge)
                           ├─ /api/*  JSON API with Server-Timing headers
                           ├─ /sdk/nexora-analytics.js  simulated slow 3rd-party script
                           └─ Durable Object per workspace (worker/workspace.ts)
                                └─ orders + profile + scenario (SQLite-backed, strongly consistent)
```

| Path | What it is |
| --- | --- |
| `shared/` | Domain model shared by browser and server: profiles, pricing, availability, the order state machine and health model |
| `worker/` | Cloudflare Worker API and the `WorkspaceStore` Durable Object |
| `src/` | Vite + React + TypeScript + Tailwind storefront and `/ops` console |
| `src/lib/rumBridge.ts` | W3C User Timing marks plus a queued bridge to `window.RProfiler.addInfo` |
| `tests/unit` | Vitest tests for pricing, the state machine and the scenario/health engine |
| `e2e/` | Playwright journeys for all scenarios |

**Why a Worker + Durable Object instead of Pages Functions + KV.** KV is eventually consistent, so a write can take up to 60 seconds to show up in other regions. An order placed in Mumbai and tracked from a probe in Frankfurt would show stale milestones. A Durable Object gives each workspace one strongly consistent home, needs no manual provisioning, and runs on the Workers free plan.

**Order progression without cron.** Orders store only their creation time, any stall and any recovery time. Milestones are derived from elapsed time on each read (`shared/engine.ts → materialize`), one stage about every 4 seconds.

## Local development

```bash
npm install
npm run dev          # Vite + Worker runtime (workerd) with HMR at http://localhost:5173
npm test             # unit tests
npm run build        # type-check + production build
npx playwright install chromium
npm run test:e2e     # builds, starts `vite preview` and runs the journeys
```

## Deploy to Cloudflare

**Automatic (default):** the repo is connected to Cloudflare Workers Builds. Every push to `main` runs `npm run build` and then `npx wrangler deploy`. Build logs are under **Workers & Pages → nexora-techstore → Deployments**.

**Manual (only if needed):**

```bash
npx wrangler login   # once
npm run deploy       # builds and runs `wrangler deploy`
```

Use one method at a time. A manual deploy is replaced by the next push to `main`.

This deploys the `nexora-techstore` Worker and its Durable Object. No KV, D1 or secrets are needed.

**Live at:** https://techstore.win (also https://www.techstore.win and https://nexora-techstore.priyansht645.workers.dev)

The custom domains are declared in `wrangler.jsonc` under `routes` (`custom_domain: true`), so Cloudflare manages their DNS records and certificates on deploy.

## Adding a RUM tag

Paste the vendor snippet between `<!-- RUM:BEGIN -->` and `<!-- RUM:END -->` in [`index.html`](index.html) `<head>`, then redeploy. `rumBridge.ts` already queues and forwards:

| Call | When |
| --- | --- |
| `addInfo('pageGroup', name)` | every route change (Home, Catalog, Product Detail, Basket, Checkout, Order Lookup, Order Tracker, Ops - …) |
| `addInfo('tracepoint', key, value)` | `profile`, `scenario`, `workspace`, `promoCode`, `addToBasket`, `checkoutStep`, `orderId`, `checkoutError`, `orderStatus`, `orderStall`, `apiError` |
| `addInfo('indicator', name, ms)` | `availabilityCheckMs`, `api:<METHOD> <path>` for every API call |
| `addInfo('conversion', name, value)` | `add_to_basket`, `order_placed`, `order_completed` |

User Timing marks/measures use the `nexora:` prefix (e.g. `nexora:availability-check`, `nexora:checkout-submit`). For debugging, the full call log is on `window.__nexoraRum.log`.

## Workspaces, profiles and scenarios

* **Workspace**: `?workspace=<id>` (stored for the browser session, sent as `X-Workspace-ID`). Each workspace has its own orders, profile and scenario. Public visitors use `public`. Presenters should use their own workspace.
* **Profile**: `telecom` (default) or `retail`. Set it per workspace in `/ops/scenarios`, or pin it per session with `?profile=retail` (`?profile=default` clears the pin).
* **Scenario**: set it per workspace in `/ops/scenarios`, or pin it per browser session with `?scenario=<id>` (`?scenario=default` clears it). A session pin overrides the workspace and never affects other visitors, which makes it ideal for synthetic monitors. A non-healthy scenario set on the shared `public` workspace from the console reverts to Healthy after 20 minutes.

| Scenario | Effect |
| --- | --- |
| `healthy` | APIs answer in 40–120 ms; orders complete all 6 milestones in about 20 s |
| `slow_experience` | `/api/catalog` and `/api/availability` take 2.8–3.8 s; `/sdk/nexora-analytics.js?delay=2500` is injected into `<head>` on hard loads |
| `checkout_failure` | `POST /api/orders` returns **502** `PAYMENT_GATEWAY_TIMEOUT` after 5 s; `/api/health` returns **503** |
| `stalled_order` | checkout returns **200**, then the order halts at milestone 3 or 5 with a business-rule reason; recover it with Retry in `/ops/orders` |

Postcodes starting with `000` are deliberately outside the coverage area. Demo checkout accepts only public test cards (`4242 4242 4242 4242`), and only the last 4 digits are ever sent to the server. Customer details are masked in all API responses.

## API

Every response carries `Server-Timing`, `X-Nexora-Service`, `X-Nexora-Scenario` and `X-Workspace-ID`, plus `Timing-Allow-Origin: *`.

| Method & path | Notes |
| --- | --- |
| `GET /api/config` | effective profile (with catalog and add-ons), scenario, workspace state, scenario catalog |
| `GET /api/catalog[?slug=&category=]` | slow under `slow_experience` |
| `GET /api/availability?postcode=` | 400 for invalid postcodes; slow under `slow_experience` |
| `POST /api/orders` | 422 with field errors, 502 under `checkout_failure` |
| `GET /api/orders[?ids=a,b]` | workspace orders with milestones derived from elapsed time |
| `GET /api/orders/:id` | 404 if unknown |
| `POST /api/orders/:id/retry` | 409 unless the order is currently stalled |
| `GET /api/scenarios` | workspace state |
| `POST /api/scenarios` | `{action:"set", scenario?, profile?}`, `{action:"seed"}`, `{action:"reset"}` |
| `GET /api/health` | service status for the 6 services; 503 while the payment gateway is critical |

## Synthetic scripting selectors

Async regions expose `data-state="idle|loading|success|error"`. Wait on that instead of using sleeps.

| Step | Selector (`data-testid`) | Notes |
| --- | --- | --- |
| Header | `nav-home`, `nav-catalog`, `nav-orders`, `nav-basket`, `basket-count`, `nav-menu-toggle` | |
| Home | `hero-title`, `btn-hero-cta`, `btn-hero-track`, `featured-grid` (data-state), `guarantees`, `link-view-all` | |
| Catalog | `category-filters`, `filter-all`, `filter-<category-slug>`, `input-search`, `select-sort`, `catalog-grid` (data-state, data-count), `product-card-<slug>`, `btn-configure-<slug>`, `catalog-empty` | |
| Product | `product-detail` (data-slug), `product-name`, `variant-<id>`, `addon-<id>`, `btn-qty-decrease`, `btn-qty-increase`, `product-qty`, `product-price` | |
| Availability | `availability-checker` (data-state), `input-postcode`, `btn-check-availability` (data-state), `availability-result` (data-available), `availability-latency`, `availability-hub`, `availability-error` | |
| Add to basket | `btn-add-to-basket` (disabled until available), `added-to-basket`, `btn-view-basket` | |
| Basket | `basket-lines`, `basket-line-<i>`, `btn-increase-<i>`, `btn-decrease-<i>`, `qty-<i>`, `btn-remove-<i>`, `input-promo`, `btn-apply-promo`, `promo-message`, `basket-subtotal`, `basket-discount`, `basket-total`, `btn-proceed-checkout`, `basket-empty` | |
| Checkout | `btn-fill-demo-customer`, `checkout-form` (data-state), `input-fullname`, `input-email`, `input-phone`, `input-line1`, `input-line2`, `input-city`, `input-checkout-postcode`, `slot-<value>`, `select-preference`, `toggle-tax-invoice`, `input-tax-id`, `input-card-name`, `input-card-number`, `input-card-expiry`, `input-card-cvc`, `checkout-total`, `btn-place-order` (data-state) | |
| Checkout errors | `checkout-error` (data-code, data-status), `btn-retry-order`, `error-<field>` | |
| Order lookup | `input-order-id`, `btn-lookup-order`, `link-demo-order`, `recent-orders`, `recent-order-<id>` | |
| Order tracker | `order-detail` (data-status `in_progress\|stalled\|completed`), `order-confirmation`, `order-id`, `order-total`, `order-current-milestone`, `milestone-timeline`, `milestone-1…6` (data-state `done\|current\|pending\|failed`, data-milestone), `milestone-<n>-time`, `milestone-stall-reason`, `order-stalled-banner`, `order-completed-banner` | |
| Ops: scenarios | `btn-profile-telecom`, `btn-profile-retail`, `scenario-card-<id>` (data-active), `btn-activate-<id>`, `btn-seed-orders`, `btn-reset-workspace`, `input-workspace`, `btn-switch-workspace` | |
| Ops: orders | `ops-orders-table`, `ops-filter-<all\|in_progress\|stalled\|completed>`, `ops-order-row-<id>` (data-status), `ops-order-inspector`, `ops-stall-panel`, `btn-retry-order-ops` (data-state), `ops-event-table`, `ops-event-<eventId>` (data-outcome), `ops-view-customer-tracker` | |
| Ops: health | `ops-overall-status` (data-status), `service-<id>` (data-status), `customer-impact`, `impact-step-<n>` (data-impact) | |
| Footer | `footer-presenter-console`, `session-scenario-chip`, `demo-notice` | |

### Example synthetic journey (Playwright)

```ts
await page.goto("https://techstore.win/?workspace=synthetic-eu&scenario=healthy");
await page.getByTestId("btn-configure-fiber-1g").click();
await page.getByTestId("input-postcode").fill("94105");
await page.getByTestId("btn-check-availability").click();
await expect(page.getByTestId("availability-result")).toHaveAttribute("data-available", "true");
await page.getByTestId("btn-add-to-basket").click();
await page.getByTestId("btn-view-basket").click();
await page.getByTestId("btn-proceed-checkout").click();
await page.getByTestId("btn-fill-demo-customer").click();
await page.getByTestId("btn-place-order").click();
await expect(page.getByTestId("order-detail")).toHaveAttribute("data-status", "completed", { timeout: 40_000 });
```
