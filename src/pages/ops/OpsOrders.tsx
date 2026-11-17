import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { serviceName } from "../../../shared/profiles";
import type { OrderStatus, OrderView } from "../../../shared/types";
import { Banner, Icon, Spinner, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { ago, cx, money, time } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";

type Filter = "all" | OrderStatus;

export default function OpsOrders() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("order");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const res = useAsync((signal) => api<{ orders: OrderView[] }>("/api/orders", { signal }), []);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      void res.reload(true);
      setNow(Date.now());
    }, 3000);
    return () => clearInterval(t);
  }, [res.reload]);

  const orders = res.data?.orders ?? [];
  const counts = useMemo(
    () => ({
      all: orders.length,
      completed: orders.filter((o) => o.status === "completed").length,
      in_progress: orders.filter((o) => o.status === "in_progress").length,
      stalled: orders.filter((o) => o.status === "stalled").length,
    }),
    [orders],
  );
  const visible = orders.filter(
    (o) => (filter === "all" || o.status === filter) && (!q.trim() || `${o.id} ${o.customer.fullName} ${o.currentMilestone}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const selected = orders.find((o) => o.id === selectedId);
  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("order", id);
    else next.delete("order");
    setParams(next, { replace: true });
  };

  return (
    <div data-testid="ops-orders" data-state={res.state}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order Operations</h1>
          <p className="mt-1 text-sm text-slate-600">Live order pipeline for this workspace, refreshed every 3 seconds.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="inline-flex rounded-full border border-line bg-white p-1" role="group" aria-label="Filter by status">
            {(
              [
                ["all", "All"],
                ["in_progress", "In Progress"],
                ["stalled", "Stalled"],
                ["completed", "Completed"],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                data-testid={`ops-filter-${f}`}
                className={cx("rounded-full px-3 py-1.5 text-xs font-semibold transition", filter === f ? "bg-ink text-white" : "text-slate-600 hover:text-ink")}
              >
                {label} <span className="opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
          <input className="input py-2 sm:w-56" placeholder="Search ID, customer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" data-testid="ops-orders-search" />
        </div>
      </div>

      {res.state === "error" && <Banner tone="error" title="Couldn't load orders">{res.error?.message}</Banner>}

      <div className={cx("grid gap-6", selected && "xl:grid-cols-[1fr_520px]")}>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="ops-orders-table">
            <thead className="border-b border-line bg-surface text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Order ID</th>
                <th className="px-4 py-3 font-semibold">Profile</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Current milestone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {res.state === "loading" && !orders.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              )}
              {visible.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => select(o.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select(o.id))}
                  tabIndex={0}
                  aria-selected={o.id === selectedId}
                  className={cx("cursor-pointer transition hover:bg-slate-50 focus:bg-indigo-50 focus:outline-none", o.id === selectedId && "bg-indigo-50/70")}
                  data-testid={`ops-order-row-${o.id}`}
                  data-status={o.status}
                >
                  <td className="px-4 py-3 font-mono font-semibold">{o.id}</td>
                  <td className="px-4 py-3 capitalize">{o.profile}</td>
                  <td className="rr-mask px-4 py-3">{o.customer.fullName}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(o.totals.total)}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-500">{o.completedStages}/6</span> {o.currentMilestone}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{ago(o.updatedAt, now)}</td>
                </tr>
              ))}
              {res.state === "success" && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500" data-testid="ops-orders-empty">
                    No orders match. Seed demo orders from <Link to="/ops/scenarios" className="text-accent underline">Scenario Controls</Link>, or place one in the storefront.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selected && <Inspector order={selected} onClose={() => select(null)} onUpdated={() => res.reload(true)} />}
      </div>
    </div>
  );
}

function Inspector({ order, onClose, onUpdated }: { order: OrderView; onClose: () => void; onUpdated: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string>();

  async function retry() {
    setState("loading");
    setError(undefined);
    try {
      await api(`/api/orders/${order.id}/retry`, { method: "POST" });
      setState("success");
      onUpdated();
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <aside className="card h-fit overflow-hidden xl:sticky xl:top-32" data-testid="ops-order-inspector" data-order-id={order.id} aria-label={`Order ${order.id} events`}>
      <div className="flex items-start justify-between gap-3 border-b border-line bg-surface p-5">
        <div>
          <p className="font-mono text-lg font-semibold">{order.id}</p>
          <p className="text-sm text-slate-600">
            {order.customer.fullName} · {money(order.totals.total)} · {order.lines.map((l) => l.name).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-xs text-slate-500">Created under scenario: {order.scenario}</span>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200" aria-label="Close inspector" data-testid="btn-close-inspector">
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      {order.status === "stalled" && order.stall && (
        <div className="border-b border-rose-200 bg-rose-50 p-5" data-testid="ops-stall-panel">
          <p className="text-sm font-semibold text-rose-800">
            Stalled at milestone {order.stall.stageIndex + 1}: {order.currentMilestone}
          </p>
          <p className="mt-1 font-mono text-xs text-rose-700">
            {order.stall.code}: {order.stall.reason}
          </p>
          <p className="mt-2 text-xs text-rose-700">Every API call returned 2xx. This is a business-process failure, invisible to HTTP status monitoring.</p>
          <button className="btn mt-4 bg-rose-600 text-white hover:bg-rose-700" onClick={retry} disabled={state === "loading"} data-testid="btn-retry-order-ops" data-state={state}>
            {state === "loading" ? <Spinner /> : null} Retry / Advance Order
          </button>
          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
        </div>
      )}
      {order.recoveredAt && order.status !== "stalled" && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800" data-testid="ops-recovered-panel">
          Recovered by operator retry at {time(order.recoveredAt)}.
        </div>
      )}

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-left text-xs" data-testid="ops-event-table">
          <thead className="sticky top-0 border-b border-line bg-white text-[11px] tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2 font-semibold">Event</th>
              <th className="px-3 py-2 font-semibold">Service</th>
              <th className="px-3 py-2 text-right font-semibold">Latency</th>
              <th className="px-3 py-2 font-semibold">Technical / Business</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.events.map((e) => (
              <tr key={e.id} className={cx(e.businessOutcome === "Blocked" && "bg-rose-50/60")} data-testid={`ops-event-${e.id}`} data-outcome={e.businessOutcome}>
                <td className="px-4 py-2.5 align-top">
                  <p className="font-mono text-[11px] text-slate-500">{e.id}</p>
                  <p className="font-medium text-ink">{e.milestone}</p>
                  <p className="font-mono text-[11px] text-slate-500">{time(e.at)}</p>
                </td>
                <td className="px-3 py-2.5 align-top text-slate-600">{serviceName(e.service)}</td>
                <td className="px-3 py-2.5 text-right align-top font-mono">{e.latencyMs} ms</td>
                <td className="px-3 py-2.5 align-top">
                  <span className="font-mono text-slate-600">{e.technicalStatus}</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span
                    className={cx(
                      "font-semibold",
                      e.businessOutcome === "Blocked" ? "text-rose-700" : e.businessOutcome === "Completed" || e.businessOutcome === "Recovered" ? "text-emerald-700" : "text-indigo-700",
                    )}
                  >
                    {e.businessOutcome}
                  </span>
                  {e.detail && <p className="mt-1 text-[11px] text-rose-700">{e.detail}</p>}
                </td>
              </tr>
            ))}
            {order.status === "in_progress" && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-center text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Awaiting: {order.currentMilestone}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line p-4 text-right">
        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-accent hover:underline" data-testid="ops-view-customer-tracker">
          View customer tracker →
        </Link>
      </div>
    </aside>
  );
}
