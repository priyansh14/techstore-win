/** Simulated third-party vendors served by the Worker (see worker/vendors.ts). */
export type Vendor = "cdn" | "tags" | "analytics" | "chat" | "reviews" | "ads";

const PROD_DOMAIN = "techstore.win";

/** On techstore.win each vendor has its own subdomain; elsewhere (local, workers.dev) it is a path prefix. */
export function vendorOrigin(vendor: Vendor): string {
  const host = typeof location !== "undefined" ? location.hostname : "";
  return host === PROD_DOMAIN || host.endsWith(`.${PROD_DOMAIN}`) ? `https://${vendor}.${PROD_DOMAIN}` : `${location.origin}/tp/${vendor}`;
}

/** Loads the tag manager, which in turn loads analytics, chat and reviews from their own hosts. */
export function loadThirdParties() {
  if (document.getElementById("nx-tags")) return;
  const s = document.createElement("script");
  s.id = "nx-tags";
  s.async = true;
  s.src = `${vendorOrigin("tags")}/gtm.js?id=NX-4821`;
  document.head.appendChild(s);
}

declare global {
  interface Window {
    /** Data layer: events raised before the tag manager loaded, drained by it on start-up. */
    nexoraDataLayer?: { type: string; detail: Record<string, unknown> }[];
    NexoraTags?: unknown;
  }
}

/** Page events the tag manager forwards to the analytics collector and ad pixel. */
export function emitPageEvent(type: "pageview" | "conversion", detail: Record<string, unknown>) {
  if (!window.NexoraTags) {
    (window.nexoraDataLayer ??= []).push({ type, detail });
    return;
  }
  window.dispatchEvent(new CustomEvent(`nexora:${type}`, { detail }));
}
