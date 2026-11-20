import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { ScenarioId, ServiceHealth } from "../../../shared/types";
import { Banner, Spinner } from "../../components/ui";
import { cx, time } from "../../lib/format";
import { sessionHeaders } from "../../lib/session";
import { useAsync } from "../../lib/useAsync";
import { useConfig } from "../../state/AppContext";

interface Health {
  status: "healthy" | "degraded" | "critical";
  scenario: ScenarioId;
  scenarioRegion?: "all" | "uk" | "non_uk";
  services: ServiceHealth[];
  orders: { total: number; completed: number; inProgress: number; stalled: number };
  checkedAt: number;
}

/** /api/health intentionally answers 503 while payments are down, so read the body either way. */
async function fetchHealth(signal: AbortSignal, headers: Record<string, string>): Promise<Health> {
  const res = await fetch("/api/health", { signal, headers });
  if (res.status !== 200 && res.status !== 503) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

const TONE = {
  Healthy: { dot: "bg-emerald-500", ring: "border-line", text: "text-emerald-700" },
  Degraded: { dot: "bg-amber-500", ring: "border-amber-300", text: "text-amber-700" },
  Critical: { dot: "bg-rose-500", ring: "border-rose-300", text: "text-rose-700" },
};

const IMPACT: Record<ScenarioId, { title: string; body: string; steps: [string, "ok" | "slow" | "fail" | "stall"][] }> = {
  healthy: {
    title: "No customer impact",
    body: "All dependencies are healthy. Customers browse, check availability, check out and see orders complete end to end in about 20 seconds.",
    steps: [["Browse", "ok"], ["Availability", "ok"], ["Basket", "ok"], ["Checkout", "ok"], ["Fulfilment", "ok"]],
  },
  slow_experience: {
    title: "Slower pages, journey still completes",
    body: "Catalog & Pricing and Availability & Inventory are responding in 2.8–3.8 s, and a third-party analytics script adds ~2.5 s to page load. Customers wait on product listings and availability checks. Expect higher page-load and step timings in RUM and synthetic data, with no errors.",
    steps: [["Browse", "slow"], ["Availability", "slow"], ["Basket", "ok"], ["Checkout", "ok"], ["Fulfilment", "ok"]],
  },
  checkout_failure: {
    title: "Customers cannot complete checkout",
    body: "The Payment Gateway Adapter is timing out against the upstream card processor after 5000 ms and returning HTTP 502. Customers reach checkout and then see a payment error, so revenue is lost at the final funnel step.",
    steps: [["Browse", "ok"], ["Availability", "ok"], ["Basket", "ok"], ["Checkout", "fail"], ["Fulfilment", "fail"]],
  },
  stalled_order: {
    title: "Orders accepted but never fulfilled",
    body: "Checkout returns HTTP 200 and customers see a confirmation, but the Order Orchestrator halts orders at an inventory or provisioning business rule. Technical monitoring is green while the business outcome fails. Recover stalled orders from Order Operations.",
    steps: [["Browse", "ok"], ["Availability", "ok"], ["Basket", "ok"], ["Checkout", "ok"], ["Fulfilment", "stall"]],
  },
};

export default function OpsHealth() {
  const config = useConfig();
  const res = useAsync((signal) => fetchHealth(signal, sessionHeaders()), [config.workspace, config.scenario, config.workspaceState.scenario, config.workspaceState.scenarioRegion]);

  useEffect(() => {
    const t = setInterval(() => void res.reload(true), 5000);
    return () => clearInterval(t);
  }, [res.reload]);

  const h = res.data;
  const impact = IMPACT[h?.scenario ?? config.scenario];

  return (
    <div className="space-y-8" data-testid="ops-health" data-state={res.state}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations & Service Health</h1>
          <p className="mt-1 text-sm text-slate-600">Nexora platform services for workspace {config.workspace}. Refreshes every 5 seconds.</p>
        </div>
        {h && (
          <div
            className={cx(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset",
              h.status === "healthy" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : h.status === "degraded" ? "bg-amber-50 text-amber-800 ring-amber-600/20" : "bg-rose-50 text-rose-700 ring-rose-600/20",
            )}
            data-testid="ops-overall-status"
            data-status={h.status}
          >
            <span className={cx("h-2 w-2 rounded-full", h.status === "healthy" ? "bg-emerald-500" : h.status === "degraded" ? "bg-amber-500" : "bg-rose-500 animate-pulse")} />
            Platform {h.status} · {time(h.checkedAt)}
          </div>
        )}
      </div>

      {res.state === "error" && <Banner tone="error" title="Health check failed">{res.error?.message}</Banner>}
      {!h && res.state === "loading" && <Spinner className="h-6 w-6 text-accent" />}

      {h && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {h.services.map((s) => (
              <article key={s.id} className={cx("card border p-5", TONE[s.status].ring)} data-testid={`service-${s.id}`} data-status={s.status}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{s.name}</h2>
                    <p className="text-xs text-slate-500">{s.description}</p>
                  </div>
                  <span className={cx("flex items-center gap-1.5 text-xs font-semibold", TONE[s.status].text)}>
                    <span className={cx("h-2 w-2 rounded-full", TONE[s.status].dot, s.status !== "Healthy" && "animate-pulse")} />
                    {s.status}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface p-2">
                    <dt className="text-[11px] text-slate-500">p95</dt>
                    <dd className="font-mono text-sm font-semibold">{s.p95Ms >= 1000 ? `${(s.p95Ms / 1000).toFixed(1)} s` : `${s.p95Ms} ms`}</dd>
                  </div>
                  <div className="rounded-xl bg-surface p-2">
                    <dt className="text-[11px] text-slate-500">Errors</dt>
                    <dd className="font-mono text-sm font-semibold">{s.errorRate}%</dd>
                  </div>
                  <div className="rounded-xl bg-surface p-2">
                    <dt className="text-[11px] text-slate-500">Requests</dt>
                    <dd className="font-mono text-sm font-semibold">{s.requests}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-600">{s.note}</p>
              </article>
            ))}
          </div>

          <section className="card p-6" data-testid="customer-impact" aria-labelledby="impact-heading">
            <p className="eyebrow mb-2">Customer Impact Correlation</p>
            <h2 id="impact-heading" className="text-xl font-semibold">
              {impact.title}
              {h.scenario !== "healthy" && h.scenarioRegion === "uk" && <span className="ml-2 rounded-full bg-amber-50 px-2.5 py-0.5 align-middle text-xs font-semibold text-amber-800 ring-1 ring-amber-200" data-testid="impact-region">UK visitors only</span>}
              {h.scenario !== "healthy" && h.scenarioRegion === "non_uk" && <span className="ml-2 rounded-full bg-amber-50 px-2.5 py-0.5 align-middle text-xs font-semibold text-amber-800 ring-1 ring-amber-200" data-testid="impact-region">Outside the UK only</span>}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{impact.body}</p>
            <ol className="mt-6 grid gap-2 sm:grid-cols-5">
              {impact.steps.map(([label, st], i) => (
                <li
                  key={label}
                  className={cx(
                    "rounded-xl border px-3 py-3 text-center text-sm font-medium",
                    st === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    st === "slow" && "border-amber-200 bg-amber-50 text-amber-800",
                    st === "fail" && "border-rose-200 bg-rose-50 text-rose-800",
                    st === "stall" && "border-orange-200 bg-orange-50 text-orange-800",
                  )}
                  data-testid={`impact-step-${i}`}
                  data-impact={st}
                >
                  {label}
                  <span className="block text-xs font-normal opacity-80">{{ ok: "Normal", slow: "Slow", fail: "Failing", stall: "Stalling" }[st]}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-4">
              {(
                [
                  ["Orders", h.orders.total],
                  ["Completed", h.orders.completed],
                  ["In progress", h.orders.inProgress],
                  ["Stalled", h.orders.stalled],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className={cx("text-2xl font-semibold", k === "Stalled" && v > 0 && "text-rose-600")}>{v}</p>
                </div>
              ))}
            </div>
            {h.orders.stalled > 0 && (
              <Link to="/ops/orders" className="btn-dark mt-6" data-testid="link-stalled-orders">
                Review {h.orders.stalled} stalled order{h.orders.stalled === 1 ? "" : "s"} →
              </Link>
            )}
          </section>
        </>
      )}
    </div>
  );
}
