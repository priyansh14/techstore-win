/**
 * RUM bridge for Catchpoint RUM (window.RProfiler).
 *
 * - Records W3C User Timing marks/measures (prefixed `nexora:`), which any RUM tool can read.
 * - Forwards business context through RProfiler.addInfo(...). Calls made before the RUM tag has
 *   loaded are queued and flushed on the tag's `GlimpseLoaded` event (or by a polling fallback).
 *
 * Catchpoint tag-token rules: lowercase, letters/digits only, at most 30 characters.
 * Tracepoint values are truncated to 32 characters. Every token used here is listed in
 * RUM_TOKENS so the Catchpoint configuration can be copied from one place.
 */
type InfoCall = [string, ...unknown[]];

interface RProfilerLike {
  addInfo: (kind: string, ...args: unknown[]) => void;
}

declare global {
  interface Window {
    RProfiler?: RProfilerLike;
    /** Every bridge call, newest last. Handy for synthetic scripts and debugging. */
    __nexoraRum?: { log: { at: number; call: InfoCall }[]; pending: () => number; tokens: typeof RUM_TOKENS };
  }
}

/** Single source of truth for the tokens configured in Catchpoint. */
export const RUM_TOKENS = {
  pageGroups: {
    home: "Home",
    catalog: "Catalog",
    productdetail: "Product Detail",
    basket: "Basket",
    checkout: "Checkout",
    orderlookup: "Order Lookup",
    ordertracker: "Order Tracker",
    opshealth: "Ops Service Health",
    opsorders: "Ops Order Operations",
    opsscenarios: "Ops Scenario Controls",
    notfound: "Not Found",
  },
  variations: { telecom: "Telecom profile", retail: "Retail profile" },
  /** Insights configured in Catchpoint (Settings > Insight). Tokens not listed there are ignored, so none are sent. */
  tracepoints: {
    scenario: "Scenario",
    workspace: "Workspace",
    orderid: "Order ID",
    paymenterror: "Checkout Error",
    checkoutstep: "Checkout Step",
    trafficsrc: "Traffic Source",
  },
  indicators: {
    availms: "Availability Check ms",
    checkoutms: "Checkout Payment ms",
  },
} as const;

export type PageGroupToken = keyof typeof RUM_TOKENS.pageGroups;
export type TracepointToken = keyof typeof RUM_TOKENS.tracepoints;
export type IndicatorToken = keyof typeof RUM_TOKENS.indicators;
export type VariationToken = keyof typeof RUM_TOKENS.variations;

const queue: InfoCall[] = [];
const log: { at: number; call: InfoCall }[] = [];
let poller: ReturnType<typeof setInterval> | undefined;
let pollUntil = 0;

function agent(): RProfilerLike | undefined {
  const rp = typeof window !== "undefined" ? window.RProfiler : undefined;
  return rp && typeof rp.addInfo === "function" ? rp : undefined;
}

function flush(): boolean {
  const rp = agent();
  if (!rp) return false;
  while (queue.length) {
    const [kind, ...args] = queue.shift()!;
    try {
      rp.addInfo(kind, ...args);
    } catch {
      // Never let telemetry break the storefront.
    }
  }
  return true;
}

function enqueue(call: InfoCall) {
  log.push({ at: Date.now(), call });
  if (log.length > 500) log.shift();
  queue.push(call);
  if (flush()) return;
  pollUntil = Date.now() + 120_000;
  poller ??= setInterval(() => {
    if (flush() || Date.now() > pollUntil) {
      clearInterval(poller);
      poller = undefined;
    }
  }, 1000);
}

function safeMark(name: string, detail?: unknown) {
  try {
    performance.mark(name, { detail });
  } catch {
    /* unsupported */
  }
}

const tpValue = (v: string | number) => String(v).slice(0, 32);

export const rum = {
  /** W3C performance.mark with a `nexora:` prefix. */
  mark(name: string, detail?: unknown) {
    safeMark(`nexora:${name}`, detail);
  },
  /** performance.measure between two `nexora:` marks. Returns duration in ms. */
  measure(name: string, startMark?: string, endMark?: string): number | undefined {
    try {
      const m = performance.measure(`nexora:${name}`, startMark ? `nexora:${startMark}` : undefined, endMark ? `nexora:${endMark}` : undefined);
      return Math.round(m.duration);
    } catch {
      return undefined;
    }
  },
  pageGroup(token: PageGroupToken) {
    safeMark(`nexora:page:${token}`);
    enqueue(["pageGroup", token]);
  },
  variation(token: VariationToken) {
    enqueue(["variation", token]);
  },
  tracepoint(token: TracepointToken, value: string | number) {
    enqueue(["tracepoint", token, tpValue(value)]);
  },
  indicator(token: IndicatorToken, value: number) {
    if (Number.isFinite(value)) enqueue(["indicator", token, Math.round(value)]);
  },
  /** Catchpoint conversion: revenue and number of items sold. */
  conversion(revenue: number, items: number) {
    safeMark("nexora:conversion", { revenue, items });
    enqueue(["conversion", Math.round(revenue * 100) / 100, Math.max(1, Math.round(items))]);
  },
};

if (typeof window !== "undefined") {
  window.__nexoraRum = { log, pending: () => queue.length, tokens: RUM_TOKENS };
  // The Catchpoint tag fires GlimpseLoaded once RProfiler is ready.
  window.addEventListener("GlimpseLoaded", () => flush());
}
