/**
 * RUM bridge: records business context as W3C User Timing marks and forwards it to a
 * RUM agent once one is present on the page (window.RProfiler, e.g. Catchpoint RUM).
 * Calls made before the agent loads are queued and flushed automatically.
 */
type InfoKind = "pageGroup" | "tracepoint" | "indicator" | "conversion";
type InfoCall = [InfoKind, ...unknown[]];

interface RProfilerLike {
  addInfo: (kind: string, ...args: unknown[]) => void;
}

declare global {
  interface Window {
    RProfiler?: RProfilerLike;
    /** Every bridge call, newest last. Handy for synthetic scripts and debugging. */
    __nexoraRum?: { log: { at: number; call: InfoCall }[]; pending: () => number };
  }
}

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

export const rum = {
  /** W3C performance.mark with a `nexora:` prefix. */
  mark(name: string, detail?: unknown) {
    safeMark(`nexora:${name}`, detail);
  },
  /** performance.measure between two marks (start defaults to navigation start). Returns duration in ms. */
  measure(name: string, startMark?: string, endMark?: string): number | undefined {
    try {
      const m = performance.measure(`nexora:${name}`, startMark ? `nexora:${startMark}` : undefined, endMark ? `nexora:${endMark}` : undefined);
      return Math.round(m.duration);
    } catch {
      return undefined;
    }
  },
  pageGroup(name: string) {
    safeMark(`nexora:page:${name}`);
    enqueue(["pageGroup", name]);
  },
  tracepoint(key: string, value: string | number) {
    enqueue(["tracepoint", key, String(value)]);
  },
  indicator(name: string, value: number) {
    enqueue(["indicator", name, Math.round(value)]);
  },
  conversion(name: string, value?: number) {
    safeMark(`nexora:conversion:${name}`, { value });
    enqueue(value === undefined ? ["conversion", name] : ["conversion", name, value]);
  },
};

if (typeof window !== "undefined") {
  window.__nexoraRum = { log, pending: () => queue.length };
}
