# Nexora — Full Build Specification

Build a complete, production-ready, publicly accessible full-stack web application in this repository (`https://github.com/priyansh14/techstore-win`) designed to be deployed on **Cloudflare Pages** with **Cloudflare Pages Functions** (Workers) and optional **Cloudflare KV** persistence.

Do **not** include any external RUM vendor script tags yet—leave a clearly commented placeholder block in `index.html` `<head>` where a RUM script can be pasted later, while keeping clean internal telemetry hooks (`rumBridge.ts` and W3C Performance marks) ready in the codebase.

---

### 1. Product Purpose & Core Architecture
Create **Nexora**, a fictional premium technology and connectivity storefront that works like a real, publicly accessible modern e-commerce & service-provisioning site, while also serving as a realistic target application for **Synthetic multi-step transaction monitoring**, **API/waterfall analysis**, **Real User Monitoring (RUM)**, and **backend order-progression observability**.

- **Tech Stack & Deployment Target:**
  - **Vite + React + TypeScript + Tailwind CSS** for the frontend, outputting static assets to `dist/`.
  - **Cloudflare Pages Functions** (`/functions/api/*`) in TypeScript for the backend APIs so the frontend and API deploy together seamlessly on Cloudflare Pages.
  - Configure `public/_redirects` (`/* /index.html 200`) and `wrangler.toml` so clean client-side routes (`/`, `/catalog`, `/product/:slug`, `/basket`, `/checkout`, `/orders`, `/orders/:orderId`, `/ops`, `/ops/orders`, `/ops/scenarios`) work on both hard browser page loads and SPA soft navigations.
- **Important Boundaries:**
  - Nexora is the *monitored application itself*. Do **not** style or label its internal presenter/operator views to mimic Catchpoint, LogicMonitor, or any third-party observability vendor UI. Keep Nexora's brand identity cohesive across the public storefront and the internal operations console.
  - **No External Stock Images & No Slow Binary Asset Generation:** Do **not** hotlink external image URLs (such as Unsplash) that can fail or pollute network waterfalls, and do **not** generate PNG/JPG files. Instead, build clean, crisp, modular **custom SVG product illustrations** (`src/components/ProductIllustration.tsx`) with explicit `width` and `height` attributes, responsive scaling, and meaningful `alt` / `aria-label` attributes.

---

### 2. Configurable Multi-Profile Commerce Engine (Workspace-Isolated)
Build a single shared commerce, basket, checkout, and order-progression engine driven by structured configuration profiles (`src/config/profiles.ts` mirrored in `functions/lib/profiles.ts`).

- **Workspace Isolation:** Support multiple simultaneous presenters without collisions using a workspace ID (resolved from `?workspace=<id>` URL param → `sessionStorage` → default `"public"`), passed automatically on every API request via the `X-Workspace-ID` header. Public visitors on `techstore.win` simply use the default `"public"` workspace and experience a completely normal, functioning store.
- **Two Switchable Demo Profiles (Default: `telecom`):**

#### Profile A: `telecom` — Nexora Fiber & Connectivity
- **Catalog (4 core services + 2 optional add-ons):**
  1. **Nexora Fiber 1 Gbps** (`slug: "fiber-1g"`) — Symmetrical 1000 Mbps FTTH, Wi-Fi 7 router included, unlimited data. Tiers: `12-Month Contract` / `No-Lock Monthly`.
  2. **Nexora Fiber 300 Mbps** (`slug: "fiber-300m"`) — Everyday ultra-reliable home fiber broadband, Wi-Fi 6E router included. Tiers: `12-Month Contract` / `No-Lock Monthly`.
  3. **Nexora Business Dedicated 2 Gbps** (`slug: "biz-2g"`) — Dedicated symmetrical fiber with 99.95% SLA and 4-hour priority engineer response. Tiers: `Standard SLA` / `24x7 Mission-Critical SLA`.
  4. **Nexora 5G Backup Failover Kit** (`slug: "backup-5g"`) — Automatic sub-second LTE/5G cellular failover gateway for uninterrupted connectivity. Tiers: `50 GB Failover Pool` / `Unlimited Failover Pool`.
  - **Add-ons:** `Static IPv4 Block (/29)` and `Whole-Home Wi-Fi 7 Mesh Node`.
- **Service-Specific Journey Fields:** Service address & postcode/PIN availability check (`GET /api/availability`), preferred engineer installation window (`Morning 09:00–12:00`, `Afternoon 13:00–17:00`, `Self-Install Kit`), and router preference.
- **6-Stage Order Milestone Chain:**
  1. `Order received`
  2. `Customer validated`
  3. `Line availability checked`
  4. `Order accepted`
  5. `ONT & circuit provisioning started`
  6. `Service active`

#### Profile B: `retail` — Nexora Devices & Hardware
- **Catalog (4 core products + 2 optional add-ons):**
  1. **Nexora StudioBook Pro 14** (`slug: "studiobook-14"`) — Precision CNC aluminum workstation laptop, 14" OLED 120Hz display. Variants: `16GB / 512GB SSD` / `32GB / 1TB SSD`.
  2. **Nexora Aero ANC Headphones** (`slug: "aero-anc"`) — Adaptive hybrid noise-cancelling studio wireless headphones, 45-hour battery. Variants: `Obsidian Matte` / `Silver Frost`.
  3. **Nexora DockOne Thunderbolt Hub** (`slug: "dockone-hub"`) — 12-in-1 Thunderbolt 4 desktop docking station with 96W host charging. Variants: `Standard 0.8m Cable` / `Pro 2m Braided Cable`.
  4. **Nexora Wi-Fi 7 Mesh Tri-Pack** (`slug: "wifi7-mesh"`) — Whole-home tri-band Wi-Fi 7 mesh system covering up to 6,500 sq. ft. Variants: `2-Pack` / `3-Pack`.
  - **Add-ons:** `Nexora Care+ 2-Year Accidental Protection` and `Priority Express Courier`.
- **Retail-Specific Journey Fields:** Delivery postcode/PIN stock & dispatch check (`GET /api/availability`), delivery speed (`Standard 2-Day`, `Next-Day Express`), and GST/Tax invoice toggle.
- **6-Stage Order Milestone Chain:**
  1. `Order received`
  2. `Payment & fraud validated`
  3. `Warehouse stock reserved`
  4. `Order accepted`
  5. `Dispatch & carrier handoff`
  6. `Delivered`

---

### 3. Public Customer-Facing Storefront Experience
Build a restrained, high-contrast, luxury technology aesthetic (warm off-white `#F8FAFC` / `#FFFFFF` surfaces, deep slate `#0F172A` typography, subtle `#E2E8F0` borders, and a refined cobalt/indigo `#4F46E5` primary accent). Ensure responsive layouts across desktop, tablet, and mobile, plus full keyboard and touch accessibility.

**Customer Routes & Functionality:**
1. **`/` (Storefront Home):**
   - Profile-aware hero banner with primary CTA to browse catalog and inline quick-availability checker.
   - Featured 4-item product/plan grid with crisp SVG hardware/network visuals, key specs, pricing, and direct "Configure" links.
   - Service guarantees / SLA highlight strip and quick link to track an existing order.
2. **`/catalog` (Browse & Filter):**
   - Category filter pills (`All`, plus profile-specific categories) that update smoothly via SPA navigation, search/sort controls, and responsive product/plan cards.
3. **`/product/:slug` (Configure & Check Availability):**
   - Variant/tier selector, optional add-on checkboxes, live price calculation, and an interactive **Availability & Coverage Checker** (`input-postcode` + `btn-check-availability` calling `GET /api/availability`) displaying real-time latency, local hub/exchange info, and stock/line status before enabling **Add to Basket**.
4. **`/basket` (Basket & Promo Codes):**
   - Full line-item management (increment/decrement quantity, remove item, persistent basket state in `localStorage`), subtotal/tax/total breakdown, and promo code box:
     - `WELCOME10` applies a valid 10% discount.
     - `BROKEN50` intentionally triggers an uncaught client-side `TypeError` (useful for demonstrating client-side JS error capture and session replay).
   - Clear **Proceed to Checkout** CTA.
5. **`/checkout` (Checkout & Order Submission):**
   - Clean multi-section checkout form (Contact details, Service/Delivery address, Installation/Shipping slot, Mock payment card details) with a convenient **"Fill Demo Customer"** button (`data-testid="btn-fill-demo-customer"`) so both humans and synthetic scripts can populate valid details in one click.
   - Submits to `POST /api/orders`. Handles validation errors and simulated payment gateway failures gracefully with clear user-facing error banners and retry options.
6. **`/orders` & `/orders/:orderId` (Order Confirmation & Live Progress Tracker):**
   - Order lookup page (`/orders`) showing recent workspace orders plus lookup by Demo Order ID (e.g., `NX-2026-4821`).
   - Detailed order tracker (`/orders/:orderId`) displaying order metadata, line items, and a **6-step timestamped milestone timeline**. Automatically polls `GET /api/orders/:orderId` every 3 seconds so the audience sees milestones advance in real time—or clearly highlights the exact milestone where an order stalled and why.

---

### 4. Reusable Scenario & Fault-Injection Engine
Implement a stateful scenario controller (`GET/POST /api/scenarios`) supporting **4 reusable scenarios** + instant reset. Allow scenarios to be activated either from `/ops/scenarios` **or** via URL query parameter (`?scenario=slow_experience`, `?scenario=checkout_failure`, `?scenario=stalled_order`, `?scenario=healthy`) so synthetic monitors can test specific scenarios deterministically on demand:

1. **`healthy` (Healthy Journey — Default):**
   - Fast API responses (`40–120ms`), availability checks succeed, checkout succeeds, and orders progress automatically across all 6 milestones (advancing 1 stage every ~4 seconds) to full completion.
2. **`slow_experience` (Slow Experience / Latency Degradation):**
   - Injects realistic server-side latency (`2800ms–3800ms`) on `GET /api/availability` and `GET /api/catalog`, plus a simulated `2500ms` slow third-party script delay (`/sdk/nexora-analytics.js?delay=2500`) so page load metrics, resource waterfalls, and synthetic step timings visibly degrade while still completing successfully.
3. **`checkout_failure` (Checkout / Payment Failure):**
   - Causes `POST /api/orders` to fail during payment authorization with HTTP `502` (`PAYMENT_GATEWAY_TIMEOUT`: *"Upstream card processor timed out after 5000ms"*), demonstrating checkout funnel drop-off and failed synthetic transaction steps.
4. **`stalled_order` (Post-Checkout Business-Process Stall):**
   - Checkout succeeds with HTTP `200` and the customer lands on a valid order confirmation page (`Order received` and `Customer validated` succeed), **but** the order halts at milestone 3 (`Line availability checked` / `Warehouse stock reserved`) or milestone 5 (`ONT & circuit provisioning started` / `Dispatch & carrier handoff`) with a realistic business-rule failure reason (e.g., *"Regional provisioning rule failed: Optical splitter port reservation timeout"* or *"Warehouse allocation rule failed: Batch SKU lock conflict"*).
   - Provide a **Retry / Recover Order** action (`POST /api/orders/:id/retry`) in Order Operations that resolves the fault and completes the remaining milestones live.

---

### 5. Presenter-Only Internal Views (`/ops/*`)
Add a subtle, unobtrusive **"Presenter Console"** link in the site footer leading to dedicated internal routes with a shared presenter top navigation bar:

1. **`/ops/scenarios` (Scenario Controls):**
   - Toggle active profile (`Telecom` vs. `Retail`) for the current workspace.
   - Select any of the 4 scenarios (`Healthy`, `Slow Experience`, `Checkout Failure`, `Stalled Order`) with clear cards explaining what the customer experiences and what telemetry signals appear.
   - One-click **Reset Workspace** (clears orders and resets to `Healthy`) and **Seed Demo Orders** (populates realistic completed, in-progress, and stalled orders for instant dashboard walkthroughs).
2. **`/ops/orders` (Order Operations):**
   - Filterable live table of workspace orders showing Order ID, Profile, Customer, Total, Current Milestone, Status badge (`Completed`, `In Progress`, `Stalled`), and Last Updated timestamp.
   - Clicking an order opens an event inspector showing the **complete chain of business events** (Event ID, Timestamp, Microservice Source, Latency ms, Technical Status vs. Business Outcome, and Failure Detail) plus a **Retry / Advance Order** button for stalled orders.
3. **`/ops` (Operations & Service Health):**
   - Displays Nexora's 6 internal services (`Storefront Edge`, `Catalog & Pricing Service`, `Availability & Inventory API`, `Payment Gateway Adapter`, `Order Orchestrator`, `Provisioning & Fulfillment Engine`) with live status (`Healthy`, `Degraded`, `Critical`), p95 latency, error rate, and a clear **Customer Impact Correlation** panel explaining how backend state affects the active storefront journey.

---

### 6. Backend APIs, Synthetic/RUM Readiness & Persistence
1. **Cloudflare Pages Functions (`/functions/api/*`):**
   - `GET /api/config` — Returns active profile, catalog, add-ons, and active scenario.
   - `GET /api/availability` — Validates postcode/PIN and returns availability + hub details (respects `slow_experience`).
   - `GET /api/catalog` — Returns profile catalog items (respects `slow_experience`).
   - `POST /api/orders` — Creates a new order and initializes its milestone event chain (fails with `502` under `checkout_failure`).
   - `GET /api/orders` & `GET /api/orders/:id` — Returns workspace orders and dynamically advances milestones based on elapsed timestamps (no external cron worker needed!) unless halted by `stalled_order`.
   - `POST /api/orders/:id/retry` — Clears a stall on an order and resumes milestone progression to completion.
   - `GET /api/scenarios` & `POST /api/scenarios` — Gets/updates workspace profile, active scenario, seeds sample orders, or resets workspace state.
   - `GET /api/health` — Returns structured dependency health JSON (`200` when healthy/degraded, `503` when payment gateway failure is active).
   - Include `Server-Timing`, `X-Nexora-Service`, `X-Nexora-Scenario`, and `X-Workspace-ID` headers on all API responses for waterfall diagnostics.
2. **Persistence Layer (`functions/lib/store.ts`):**
   - Use Cloudflare KV (`env.NEXORA_STATE`) when bound in production, with a clean in-memory Map fallback for local development and unconfigured deployments so the site works 100% out of the box immediately upon deploying to Cloudflare Pages. Include `wrangler.toml`.
3. **RUM & Synthetic Readiness (Without External RUM Script):**
   - Add deterministic `data-testid` and `id` attributes plus `data-state="idle|loading|success|error"` on all interactive elements and async regions so Playwright/Puppeteer synthetic scripts run reliably without race conditions.
   - Implement `src/lib/rumBridge.ts` to emit W3C `performance.mark()` / `performance.measure()` events and safely queue `window.RProfiler?.addInfo(...)` calls (`pageGroup`, `tracepoint`, `indicator`, `conversion`) so as soon as a RUM snippet is added to the commented `<head>` slot in `index.html`, all business context flows automatically.

---

### 7. Documentation & Automated End-to-End Verification
1. **`README.md`:** Document the architecture, local development setup (`npm install`, `npm run dev`), Cloudflare Pages deployment instructions (including optional KV namespace binding), where to paste the RUM tag in `index.html`, and a complete table of `data-testid` selectors for scripting synthetic journeys.
2. **Verification:**
   - Write and run unit/integration tests (Vitest) for the order state machine, milestone progression, and scenario engine.
   - Write and run Playwright end-to-end tests verifying:
     1. Public storefront browsing, availability check, basket, checkout, and real-time order completion (`healthy`).
     2. Profile switching (`telecom` <-> `retail`) updating catalog items, form fields, and milestone names.
     3. `slow_experience` introducing measurable delay while completing the journey.
     4. `checkout_failure` surfacing a clear payment failure on checkout.
     5. `stalled_order` completing checkout (`HTTP 200`), stalling at the expected backend milestone, appearing in `/ops/orders`, and recovering to completion via Retry.
   - Verify `npm run build` completes cleanly with zero TypeScript or bundler errors.
