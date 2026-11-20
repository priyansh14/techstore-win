/**
 * Simulated third-party vendors and a static-asset CDN, all served by this Worker.
 *
 * In production each vendor has its own hostname (tags.techstore.win, chat.techstore.win, ...), so
 * browsers open separate DNS/TCP/TLS connections and RUM zones / synthetic waterfalls show them as
 * distinct providers. Locally (or on workers.dev) the same endpoints live under /tp/<vendor>/...
 * Nothing here depends on an external service, so the demo can't be broken by a real vendor outage.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ProductArt } from "../src/components/ProductArt";
import { PROFILES } from "../shared/profiles";

export const VENDORS = ["cdn", "tags", "analytics", "chat", "reviews", "ads"] as const;
export type Vendor = (typeof VENDORS)[number];
export const PROD_DOMAIN = "techstore.win";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

/** Resolves a request to a vendor endpoint, either by subdomain or by the /tp/<vendor> prefix. */
export function matchVendor(url: URL): { vendor: Vendor; path: string } | null {
  const sub = url.hostname.endsWith(`.${PROD_DOMAIN}`) ? url.hostname.slice(0, -PROD_DOMAIN.length - 1) : "";
  if ((VENDORS as readonly string[]).includes(sub)) return { vendor: sub as Vendor, path: url.pathname };
  const m = url.pathname.match(/^\/tp\/([a-z]+)(\/.*)$/);
  if (m && (VENDORS as readonly string[]).includes(m[1])) return { vendor: m[1] as Vendor, path: m[2] };
  return null;
}

/** Deterministic filler so scripts have realistic, poorly-compressible sizes. */
function filler(seed: string, kb: number): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lines: string[] = [];
  for (let line = 0; line < kb * 8; line++) {
    let s = "";
    for (let i = 0; i < 120; i++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      s += alphabet[(h >>> 0) % 64];
    }
    lines.push(`"${s}"`);
  }
  return `var __bundle=[\n${lines.join(",\n")}\n];`;
}
const fillerCache = new Map<string, string>();
const bundle = (seed: string, kb: number) => {
  const key = `${seed}:${kb}`;
  if (!fillerCache.has(key)) fillerCache.set(key, filler(seed, kb));
  return fillerCache.get(key)!;
};

const CORS = { "access-control-allow-origin": "*", "timing-allow-origin": "*", "access-control-allow-headers": "content-type" };

function js(body: string, vendor: Vendor, ms: number) {
  return new Response(body, {
    headers: { ...CORS, "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300", "server-timing": `vendor;desc="${vendor}";dur=${ms}`, "x-vendor": vendor },
  });
}
function json(body: unknown, vendor: Vendor, ms: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "server-timing": `vendor;desc="${vendor}";dur=${ms}`, "x-vendor": vendor },
  });
}
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
function pixel(vendor: Vendor, ms: number) {
  return new Response(GIF, { headers: { ...CORS, "content-type": "image/gif", "cache-control": "no-store", "server-timing": `vendor;desc="${vendor}";dur=${ms}` } });
}

const PRODUCTS = new Map(Object.values(PROFILES).flatMap((p) => p.products.map((x) => [x.slug, x] as const)));

/** Tag manager: loads analytics, ads and chat from their own hosts, then forwards page events to them. */
function tagManager(scriptOrigin: (v: Vendor) => string) {
  return `/* Nexora Tag Manager (simulated third party) */
(function(){
  var o = ${JSON.stringify(Object.fromEntries(VENDORS.map((v) => [v, scriptOrigin(v)])))};
  function add(src, id){ if (document.getElementById(id)) return; var s=document.createElement('script'); s.async=true; s.src=src; s.id=id; document.head.appendChild(s); }
  // In the slow scenario the edge already injected a delayed analytics SDK into <head>.
  if (!document.querySelector('script[data-testid="third-party-analytics"]')) add(o.analytics + '/sdk/nexora-analytics.js?delay=0', 'nx-analytics');
  add(o.chat + '/widget.js', 'nx-chat');
  add(o.reviews + '/widget.js', 'nx-reviews');
  function px(ev, extra){ var i=new Image(1,1); i.src=o.ads + '/px.gif?ev=' + ev + '&p=' + encodeURIComponent(location.pathname) + (extra||'') + '&r=' + Math.random().toString(36).slice(2); }
  function collect(ev, data){ try { fetch(o.analytics + '/collect', { method: 'POST', mode: 'cors', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ev: ev, path: location.pathname, ts: Date.now(), data: data || {} }) }); } catch (e) {} }
  window.addEventListener('nexora:pageview', function(e){ collect('pageview', e.detail); px('pageview'); });
  window.addEventListener('nexora:conversion', function(e){ collect('conversion', e.detail); px('conversion', '&v=' + (e.detail && e.detail.revenue || 0)); });
  window.NexoraTags = { loadedAt: Date.now(), origins: o };
  // Replay events queued in the data layer before this script arrived.
  (window.nexoraDataLayer || []).splice(0).forEach(function(e){ window.dispatchEvent(new CustomEvent('nexora:' + e.type, { detail: e.detail })); });
  window.dispatchEvent(new CustomEvent('nexora:tags-ready'));
})();
${bundle("tags", 38)}`;
}

function chatWidget(origin: string) {
  return `/* Nexora Live Chat widget (simulated third party) */
(function(){
  var o = ${JSON.stringify(origin)};
  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = o + '/widget.css'; document.head.appendChild(css);
  fetch(o + '/v1/config', { mode: 'cors' }).then(function(r){ return r.json(); }).then(function(cfg){
    if (window.innerWidth < 768 || document.getElementById('nx-chat-launcher')) return;
    var b = document.createElement('button');
    b.id = 'nx-chat-launcher'; b.type = 'button'; b.setAttribute('aria-label', 'Chat with Nexora support');
    b.setAttribute('data-testid', 'chat-launcher'); b.textContent = cfg.label;
    b.onclick = function(){ alert(cfg.greeting); };
    document.body.appendChild(b);
  }).catch(function(){});
})();
${bundle("chat", 54)}`;
}

const CHAT_CSS = `#nx-chat-launcher{position:fixed;right:20px;bottom:20px;z-index:30;border:0;border-radius:999px;padding:12px 18px;background:#0F172A;color:#fff;font:600 13px/1 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(15,23,42,.25);cursor:pointer}#nx-chat-launcher:hover{background:#4F46E5}`;

function reviewsWidget(origin: string) {
  return `/* Nexora Reviews widget (simulated third party) */
(function(){
  var o = ${JSON.stringify(origin)};
  function load(){
    var m = location.pathname.match(/^\\/product\\/([a-z0-9-]+)/);
    if (!m) return;
    fetch(o + '/v1/ratings?sku=' + m[1], { mode: 'cors' }).then(function(r){ return r.json(); }).then(function(d){ window.NexoraReviews = d; }).catch(function(){});
  }
  window.addEventListener('nexora:pageview', load);
  load();
})();
${bundle("reviews", 26)}`;
}

/** Product art served as a real image (so it shows as image requests in waterfalls). */
function productSvg(slug: string, label: string) {
  return renderToStaticMarkup(createElement(ProductArt, { slug, label, idPrefix: slug }));
}

export async function handleVendor(req: Request, vendor: Vendor, path: string, origin: (v: Vendor) => string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-max-age": "86400" } });
  const url = new URL(req.url);

  if (vendor === "cdn") {
    const m = path.match(/^\/img\/products\/([a-z0-9-]+)\.svg$/);
    const product = m && PRODUCTS.get(m[1]);
    if (!product) return new Response("Not found", { status: 404, headers: CORS });
    const ms = rand(8, 35);
    await sleep(ms);
    return new Response(productSvg(product.slug, product.name), {
      headers: { ...CORS, "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "server-timing": `cdn;desc="Image edge";dur=${ms}`, "x-vendor": "cdn" },
    });
  }

  if (vendor === "tags" && path === "/gtm.js") {
    const ms = rand(20, 70);
    await sleep(ms);
    return js(tagManager(origin), vendor, ms);
  }

  if (vendor === "analytics") {
    if (path === "/collect") {
      const ms = rand(15, 60);
      await sleep(ms);
      return new Response(null, { status: 204, headers: { ...CORS, "server-timing": `vendor;desc="analytics";dur=${ms}` } });
    }
    if (path === "/sdk/nexora-analytics.js") {
      // delay > 0 is the slow_experience scenario's deliberately slow vendor.
      const delay = Math.max(0, Math.min(8000, Number(url.searchParams.get("delay")) || 0));
      const ms = delay || rand(25, 80);
      await sleep(ms);
      const body = `/* Nexora Analytics SDK (simulated third party) */
(function(){var n=window.NexoraAnalytics=window.NexoraAnalytics||{q:[]};n.loadedAt=Date.now();n.delayMs=${delay};
try{performance.mark("nexora-analytics-loaded")}catch(e){}
window.dispatchEvent(new CustomEvent("nexora:analytics-loaded",{detail:{delayMs:${delay}}}));})();
${bundle("analytics", 22)}`;
      return new Response(body, {
        headers: {
          ...CORS,
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
          "server-timing": `thirdparty;desc="Simulated vendor latency";dur=${ms}`,
          "x-vendor": vendor,
        },
      });
    }
  }

  if (vendor === "chat") {
    if (path === "/widget.js") {
      const ms = rand(30, 90);
      await sleep(ms);
      return js(chatWidget(origin("chat")), vendor, ms);
    }
    if (path === "/widget.css") {
      return new Response(CHAT_CSS, { headers: { ...CORS, "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (path === "/v1/config") {
      const ms = rand(40, 120);
      await sleep(ms);
      return json({ label: "Chat with us", greeting: "Nexora support: agents are online 24/7. (Demo widget)", online: true, queue: rand(0, 4) }, vendor, ms);
    }
  }

  if (vendor === "reviews") {
    if (path === "/widget.js") {
      const ms = rand(25, 80);
      await sleep(ms);
      return js(reviewsWidget(origin("reviews")), vendor, ms);
    }
    if (path === "/v1/ratings") {
      const ms = rand(60, 180);
      await sleep(ms);
      const p = PRODUCTS.get(url.searchParams.get("sku") ?? "");
      return json({ sku: p?.slug ?? null, rating: p?.rating ?? null, count: p?.reviews ?? 0, provider: "Nexora Reviews" }, vendor, ms);
    }
  }

  if (vendor === "ads" && (path === "/px.gif" || path === "/conv.gif")) {
    const ms = rand(10, 45);
    await sleep(ms);
    return pixel(vendor, ms);
  }

  return new Response("Not found", { status: 404, headers: CORS });
}
