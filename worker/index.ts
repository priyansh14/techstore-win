import { checkAvailability, computeHealth, isValidPostcode, materialize, validateCheckout } from "../shared/engine";
import { isProfileId, isScenarioId, isScenarioRegion, PROFILES, regionMatches, SCENARIOS } from "../shared/profiles";
import type { CheckoutInput, ConfigResponse, OrderView, ProfileId, ScenarioId, ServiceId, WorkspaceSnapshot } from "../shared/types";

import { handleVendor, matchVendor, PROD_DOMAIN, type Vendor } from "./vendors";

export { WorkspaceStore } from "./workspace";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

interface Ctx {
  workspace: string;
  scenarioOverride?: ScenarioId;
  profileOverride?: ProfileId;
  /** Visitor country from Cloudflare (X-Nexora-Country overrides it for testing). */
  country: string;
  store: DurableObjectStub<import("./workspace").WorkspaceStore>;
  started: number;
  timings: string[];
  /** Simulated work per stage, also exposed as X-Nexora-<Stage>-Ms headers for synthetic Insights. */
  durations: Record<string, number>;
}

function cookie(req: Request, name: string): string | undefined {
  const m = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

function resolveContext(req: Request, env: Env): Ctx {
  const url = new URL(req.url);
  const rawWs = req.headers.get("x-workspace-id") || url.searchParams.get("workspace") || cookie(req, "nx_ws") || "public";
  const workspace = /^[a-z0-9][a-z0-9-]{0,39}$/i.test(rawWs) ? rawWs.toLowerCase() : "public";
  const scn = req.headers.get("x-nexora-scenario") || url.searchParams.get("scenario") || cookie(req, "nx_scn");
  const prof = req.headers.get("x-nexora-profile") || url.searchParams.get("profile") || cookie(req, "nx_prof");
  return {
    workspace,
    scenarioOverride: isScenarioId(scn) ? scn : undefined,
    profileOverride: isProfileId(prof) ? prof : undefined,
    country: (req.headers.get("x-nexora-country") || (req as { cf?: { country?: string } }).cf?.country || "XX").toUpperCase().slice(0, 2),
    store: env.WORKSPACE.get(env.WORKSPACE.idFromName(workspace)),
    started: Date.now(),
    timings: [],
    durations: {},
  };
}

async function effective(ctx: Ctx) {
  const t = Date.now();
  const snapshot = await ctx.store.snapshot(ctx.workspace);
  ctx.timings.push(`state;desc="Workspace state";dur=${Date.now() - t}`);
  // A session pin (?scenario=) always wins; a workspace scenario only applies inside its region.
  const workspaceScenario = regionMatches(snapshot.scenarioRegion, ctx.country) ? snapshot.scenario : "healthy";
  return {
    snapshot,
    scenario: ctx.scenarioOverride ?? workspaceScenario,
    profile: ctx.profileOverride ?? snapshot.profile,
  };
}

function respond(ctx: Ctx, service: ServiceId, scenario: ScenarioId, body: unknown, status = 200, extra: Record<string, string> = {}) {
  const total = Date.now() - ctx.started;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "server-timing": [...ctx.timings, `total;desc="Total";dur=${total}`].join(", "),
      "timing-allow-origin": "*",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "Server-Timing, X-Nexora-Service, X-Nexora-Scenario, X-Workspace-ID, X-Nexora-Country",
      "x-nexora-service": service,
      "x-nexora-scenario": scenario,
      "x-workspace-id": ctx.workspace,
      "x-nexora-country": ctx.country,
      // One header per timed stage (e.g. X-Nexora-Availability-Ms) so Insights can read a single number.
      ...Object.fromEntries(Object.entries(ctx.durations).map(([k, v]) => [`x-nexora-${k}-ms`, String(v)])),
      ...extra,
    },
  });
}

/** Simulated processing time, recorded in Server-Timing under `name`. */
async function work(ctx: Ctx, name: string, desc: string, ms: number) {
  await sleep(ms);
  ctx.durations[name] = ms;
  ctx.timings.push(`${name};desc="${desc}";dur=${ms}`);
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}` : "•••";
}

function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

/** Orders are viewable by ID on a public site, so personal details are always masked on the way out. */
function publicView(order: OrderView): OrderView {
  return {
    ...order,
    customer: {
      fullName: maskName(order.customer.fullName),
      email: maskEmail(order.customer.email),
      phone: `•••• ${order.customer.phone.replace(/\D/g, "").slice(-2)}`,
    },
    address: { line1: "•••• (on file)", city: order.address.city, postcode: order.address.postcode },
    journey: { ...order.journey, taxId: order.journey.taxId ? "••••" : undefined },
  };
}

async function readJson<T>(req: Request): Promise<T | null> {
  if (Number(req.headers.get("content-length") ?? 0) > 32_000) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

async function handleApi(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const ctx = resolveContext(req, env);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-workspace-id, x-nexora-scenario, x-nexora-profile",
        "access-control-max-age": "86400",
      },
    });
  }

  const { snapshot, scenario, profile: profileId } = await effective(ctx);
  const profile = PROFILES[profileId];
  // One Durable Object call per API request records the service, the edge and any extras.
  const track = (service: ServiceId, res: Response, extra: { service: ServiceId; ms: number; ok: boolean }[] = []) => {
    const ms = Date.now() - ctx.started;
    const ok = res.status < 500;
    exec.waitUntil(ctx.store.track([{ service, ms, ok }, { service: "storefront-edge", ms, ok }, ...extra]));
    return res;
  };
  const slow = scenario === "slow_experience";
  // third_party_slow: catalog and availability wait on the internal Analytics service (downstream dependency).
  const analyticsDown = scenario === "third_party_slow";

  // GET /api/promotions
  if (path === "/api/promotions" && req.method === "GET") {
    await work(ctx, "promotions", "Promotions engine", rand(30, 90));
    const promotions =
      profileId === "telecom"
        ? [
            { id: "promo-fiber", title: "3 months half price on Fiber 1 Gbps", body: "New customers on a 12-month contract. Use code WELCOME10 for a further 10% off.", code: "WELCOME10" },
            { id: "promo-mesh", title: "Free Wi-Fi 7 mesh node", body: "Add whole-home coverage at no extra cost this month.", code: null },
          ]
        : [
            { id: "promo-studio", title: "Save 10% on StudioBook Pro 14", body: "Use code WELCOME10 at checkout. Free next-day delivery on orders over $500.", code: "WELCOME10" },
            { id: "promo-care", title: "Care+ for less", body: "Two years of accidental cover with any laptop.", code: null },
          ];
    return track("catalog-pricing", respond(ctx, "catalog-pricing", scenario, { profile: profileId, promotions }));
  }

  // GET /api/recommendations?slug=
  if (path === "/api/recommendations" && req.method === "GET") {
    await work(ctx, "recommend", "Recommendation engine", slow ? rand(1200, 1800) : rand(50, 140));
    const slug = url.searchParams.get("slug");
    const products = profile.products.filter((p) => p.slug !== slug).slice(0, 3);
    return track("catalog-pricing", respond(ctx, "catalog-pricing", scenario, { profile: profileId, for: slug, products }));
  }

  // GET /api/config
  if (path === "/api/config" && req.method === "GET") {
    await work(ctx, "edge", "Edge config", rand(10, 30));
    const body: ConfigResponse = {
      workspace: ctx.workspace,
      profile,
      scenario,
      scenarioSource: ctx.scenarioOverride ? "session" : "workspace",
      profileSource: ctx.profileOverride ? "session" : "workspace",
      workspaceState: snapshot,
      country: ctx.country,
      scenarios: SCENARIOS,
      serverTime: Date.now(),
    };
    return track("storefront-edge", respond(ctx, "storefront-edge", scenario, body));
  }

  // GET /api/catalog
  if (path === "/api/catalog" && req.method === "GET") {
    if (analyticsDown) await work(ctx, "analytics-svc", "Analytics service (downstream dependency)", rand(3000, 3800));
    await work(ctx, "catalog", "Catalog & pricing lookup", slow ? rand(2800, 3800) : rand(40, 110));
    const slug = url.searchParams.get("slug");
    const category = url.searchParams.get("category");
    let products = profile.products;
    if (slug) products = products.filter((p) => p.slug === slug);
    if (category && category !== "All") products = products.filter((p) => p.category === category);
    if (slug && products.length === 0) {
      return track("catalog-pricing", respond(ctx, "catalog-pricing", scenario, { error: { code: "NOT_FOUND", message: `No product '${slug}' in ${profile.label}` } }, 404));
    }
    return track(
      "catalog-pricing",
      respond(ctx, "catalog-pricing", scenario, { profile: profileId, categories: profile.categories, products, addOns: profile.addOns }),
    );
  }

  // GET /api/availability?postcode=
  if (path === "/api/availability" && req.method === "GET") {
    const postcode = url.searchParams.get("postcode") ?? "";
    if (analyticsDown) await work(ctx, "analytics-svc", "Analytics service (downstream dependency)", rand(3000, 3800));
    await work(ctx, "availability", "Coverage & inventory check", slow ? rand(2800, 3800) : rand(45, 120));
    if (!isValidPostcode(postcode)) {
      return track(
        "availability-inventory",
        respond(ctx, "availability-inventory", scenario, { error: { code: "INVALID_POSTCODE", message: "Enter a valid postcode or PIN (3–10 letters/digits)." } }, 400),
      );
    }
    const result = checkAvailability(profileId, postcode);
    return track("availability-inventory", respond(ctx, "availability-inventory", scenario, { ...result, latencyMs: Date.now() - ctx.started }));
  }

  // POST /api/orders
  if (path === "/api/orders" && req.method === "POST") {
    const input = await readJson<CheckoutInput>(req);
    if (!input) return respond(ctx, "order-orchestrator", scenario, { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400);
    await work(ctx, "validate", "Order validation", rand(15, 40));
    const v = validateCheckout(profile, input);
    if (!v.ok) {
      return track(
        "order-orchestrator",
        respond(ctx, "order-orchestrator", scenario, { error: { code: "VALIDATION_FAILED", message: "Please correct the highlighted fields.", fields: v.errors } }, 422),
      );
    }
    if (scenario === "checkout_failure") {
      await work(ctx, "payment", "Payment authorization (timeout)", 5000);
      const res = respond(
        ctx,
        "payment-gateway",
        scenario,
        { error: { code: "PAYMENT_GATEWAY_TIMEOUT", message: "Upstream card processor timed out after 5000ms", retryable: true } },
        502,
      );
      return track("payment-gateway", res, [{ service: "order-orchestrator", ms: Date.now() - ctx.started, ok: false }]);
    }
    await work(ctx, "payment", "Payment authorization", rand(180, 420));
    const t = Date.now();
    const order = await ctx.store.createOrder(ctx.workspace, profileId, scenario, input);
    ctx.timings.push(`orchestrator;desc="Order orchestration";dur=${Date.now() - t}`);
    return track("order-orchestrator", respond(ctx, "order-orchestrator", scenario, { order: publicView(materialize(order)) }, 200), [
      { service: "payment-gateway", ms: 300, ok: true },
    ]);
  }

  // GET /api/orders
  if (path === "/api/orders" && req.method === "GET") {
    await work(ctx, "orders", "Order query", rand(20, 60));
    const ids = url.searchParams.get("ids")?.split(",").filter(Boolean);
    let orders = (await ctx.store.listOrders(ctx.workspace)).map((o) => publicView(materialize(o)));
    if (ids) orders = orders.filter((o) => ids.includes(o.id));
    return track("order-orchestrator", respond(ctx, "order-orchestrator", scenario, { orders }));
  }

  const orderMatch = path.match(/^\/api\/orders\/([A-Za-z0-9-]{3,32})(\/retry)?$/);
  if (orderMatch) {
    const id = orderMatch[1].toUpperCase();
    if (orderMatch[2] && req.method === "POST") {
      await work(ctx, "orchestrator", "Retry orchestration", rand(60, 140));
      const result = await ctx.store.retryOrder(ctx.workspace, id);
      if (!result) return respond(ctx, "order-orchestrator", scenario, { error: { code: "NOT_FOUND", message: `Order ${id} not found` } }, 404);
      if (!result.retried) {
        return respond(ctx, "order-orchestrator", scenario, { error: { code: "NOT_STALLED", message: `Order ${id} is not stalled, nothing to retry` }, order: publicView(materialize(result.order)) }, 409);
      }
      return track("order-orchestrator", respond(ctx, "order-orchestrator", scenario, { order: publicView(materialize(result.order)) }));
    }
    if (!orderMatch[2] && req.method === "GET") {
      await work(ctx, "orders", "Order lookup", rand(20, 60));
      const order = await ctx.store.getOrder(ctx.workspace, id);
      if (!order) return respond(ctx, "order-orchestrator", scenario, { error: { code: "NOT_FOUND", message: `We couldn't find order ${id} in this workspace.` } }, 404);
      return track("order-orchestrator", respond(ctx, "order-orchestrator", scenario, { order: publicView(materialize(order)) }));
    }
  }

  // GET/POST /api/scenarios
  if (path === "/api/scenarios") {
    let snap: WorkspaceSnapshot = snapshot;
    if (req.method === "POST") {
      const body = await readJson<{ action?: string; scenario?: string; profile?: string; region?: string }>(req);
      const action = body?.action ?? "set";
      if (action === "reset") snap = await ctx.store.reset(ctx.workspace);
      else if (action === "seed") snap = await ctx.store.seed(ctx.workspace, profileId);
      else if (action === "set") {
        if (body?.scenario !== undefined && !isScenarioId(body.scenario))
          return respond(ctx, "storefront-edge", scenario, { error: { code: "BAD_SCENARIO", message: `Unknown scenario '${body.scenario}'` } }, 400);
        if (body?.profile !== undefined && !isProfileId(body.profile))
          return respond(ctx, "storefront-edge", scenario, { error: { code: "BAD_PROFILE", message: `Unknown profile '${body.profile}'` } }, 400);
        if (body?.region !== undefined && !isScenarioRegion(body.region))
          return respond(ctx, "storefront-edge", scenario, { error: { code: "BAD_REGION", message: `Unknown region '${body.region}'` } }, 400);
        snap = await ctx.store.update(ctx.workspace, {
          region: body?.region as "all" | "uk" | "non_uk" | undefined,
          scenario: body?.scenario as ScenarioId | undefined,
          profile: body?.profile as ProfileId | undefined,
        });
      } else return respond(ctx, "storefront-edge", scenario, { error: { code: "BAD_ACTION", message: `Unknown action '${action}'` } }, 400);
    }
    return respond(ctx, "storefront-edge", ctx.scenarioOverride ?? snap.scenario, {
      workspace: snap,
      effectiveScenario: ctx.scenarioOverride ?? snap.scenario,
      effectiveProfile: ctx.profileOverride ?? snap.profile,
      scenarios: SCENARIOS,
    });
  }

  // GET /api/health
  if (path === "/api/health" && req.method === "GET") {
    const [orders, samples] = await Promise.all([ctx.store.listOrders(ctx.workspace), ctx.store.getSamples()]);
    const views = orders.map((o) => materialize(o));
    // The ops view shows the workspace fault even to presenters outside its region.
    const region = snapshot.scenarioRegion ?? "all";
    const opsScenario = ctx.scenarioOverride ?? snapshot.scenario;
    const services = computeHealth(opsScenario, views, samples, Date.now(), ctx.scenarioOverride ? "all" : region);
    const critical = services.some((s) => s.status === "Critical");
    const degraded = services.some((s) => s.status === "Degraded");
    const body = {
      status: critical ? "critical" : degraded ? "degraded" : "healthy",
      workspace: ctx.workspace,
      profile: profileId,
      scenario: opsScenario,
      scenarioRegion: ctx.scenarioOverride ? "all" : region,
      appliesToRequester: scenario === opsScenario,
      country: ctx.country,
      services,
      orders: {
        total: views.length,
        completed: views.filter((o) => o.status === "completed").length,
        inProgress: views.filter((o) => o.status === "in_progress").length,
        stalled: views.filter((o) => o.status === "stalled").length,
      },
      checkedAt: Date.now(),
    };
    // HTTP status follows what this caller experiences, so a UK node gets 503 for a UK-only outage.
    const paymentDownForCaller = scenario === "checkout_failure";
    return respond(ctx, "storefront-edge", scenario, body, paymentDownForCaller ? 503 : 200);
  }

  return respond(ctx, "storefront-edge", scenario, { error: { code: "NOT_FOUND", message: `No API route ${req.method} ${path}` } }, 404);
}

/** Origin of a simulated vendor: its own subdomain on techstore.win, a /tp/<vendor> path elsewhere. */
function vendorOrigin(url: URL, vendor: Vendor): string {
  const h = url.hostname;
  return h === PROD_DOMAIN || h.endsWith(`.${PROD_DOMAIN}`) ? `https://${vendor}.${PROD_DOMAIN}` : `${url.origin}/tp/${vendor}`;
}

/** Simulated slow third-party analytics script used by the slow_experience scenario. */
async function analyticsScript(url: URL): Promise<Response> {
  const delay = Math.max(0, Math.min(8000, Number(url.searchParams.get("delay")) || 0));
  await sleep(delay);
  const js = `/* Nexora Analytics SDK (simulated third party) */
(function(){var n=window.NexoraAnalytics=window.NexoraAnalytics||{q:[]};n.loadedAt=Date.now();n.delayMs=${delay};
try{performance.mark("nexora-analytics-loaded")}catch(e){}
window.dispatchEvent(new CustomEvent("nexora:analytics-loaded",{detail:{delayMs:${delay}}}));})();`;
  return new Response(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
      "timing-allow-origin": "*",
      "server-timing": `thirdparty;desc="Simulated vendor latency";dur=${delay}`,
    },
  });
}

async function serveApp(req: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  const ctx = resolveContext(req, env);
  // Serve the "third-party" SDK from its own host in production so RUM zones can separate it.
  const sdkOrigin = vendorOrigin(new URL(req.url), "analytics");
  let scenario: ScenarioId = "healthy";
  try {
    scenario = (await effective(ctx)).scenario;
  } catch {
    // State unavailable: serve the page without scenario injection.
  }
  const headers = new Headers(res.headers);
  if (scenario === "third_party_slow") {
    const ms = Math.round(3600 + Math.random() * 800);
    await sleep(ms);
    headers.set("server-timing", `analytics-svc;desc="Analytics service (downstream dependency)";dur=${ms}`);
    headers.set("x-nexora-dependency", "analytics-svc degraded");
  }
  headers.set("cache-control", "no-cache");
  headers.set("x-nexora-scenario", scenario);
  headers.set("x-workspace-id", ctx.workspace);
  headers.set("x-nexora-country", ctx.country);
  const out = new Response(res.body, { status: res.status, headers });
  return new HTMLRewriter()
    .on("html", {
      element(el) {
        el.setAttribute("data-scenario", scenario);
      },
    })
    .on("head", {
      element(el) {
        if (scenario === "slow_experience") {
          el.append(`<script async src="${sdkOrigin}/sdk/nexora-analytics.js?delay=2500" id="nx-analytics" data-testid="third-party-analytics"></script>`, { html: true });
        }
      },
    })
    .transform(out);
}

/**
 * Network Error Logging: when a Catchpoint RUM app ID is configured, browsers are told to report
 * DNS/TCP/TLS failures, abandoned requests and HTTP 4xx/5xx responses to Catchpoint.
 */
function withNel(res: Response, env: Env): Response {
  const appId = env.CATCHPOINT_RUM_APP_ID?.trim();
  if (!appId || !/^\d+$/.test(appId)) return res;
  const out = new Response(res.body, res);
  out.headers.set("Report-To", JSON.stringify({ group: "network-errors", max_age: 2592000, endpoints: [{ url: `https://r.3gl.net/hawklogserver/${appId}/re.p` }] }));
  out.headers.set("NEL", JSON.stringify({ report_to: "network-errors", max_age: 2592000, success_fraction: 0, failure_fraction: 1.0, include_subdomains: true }));
  return out;
}

async function route(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const vendor = matchVendor(url);
  if (vendor) return handleVendor(req, vendor.vendor, vendor.path, (v) => vendorOrigin(url, v));
  if (url.pathname === "/sdk/nexora-analytics.js") return analyticsScript(url);
  // Vendor hosts serve only their own endpoints; anything else goes to the storefront.
  if (url.hostname.endsWith(`.${PROD_DOMAIN}`) && url.hostname !== `www.${PROD_DOMAIN}`) return Response.redirect(`https://${PROD_DOMAIN}/`, 302);
  if (url.pathname.startsWith("/api/")) {
    try {
      return await handleApi(req, env, exec);
    } catch (err) {
      console.error("api error", err);
      return new Response(JSON.stringify({ error: { code: "INTERNAL", message: "Unexpected server error" } }), {
        status: 500,
        headers: { "content-type": "application/json", "x-nexora-service": "storefront-edge", "cache-control": "no-store" },
      });
    }
  }
  return serveApp(req, env);
}

export default {
  async fetch(req, env, exec): Promise<Response> {
    return withNel(await route(req, env, exec), env);
  },
} satisfies ExportedHandler<Env>;
