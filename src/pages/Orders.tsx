import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { OrderView } from "../../shared/types";
import { Icon, PageHeader, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { ago, money } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp, useConfig } from "../state/AppContext";

export default function Orders() {
  const { myOrders } = useApp();
  const { profile } = useConfig();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState<string>();
  const year = new Date().getFullYear();

  const recent = useAsync(
    (signal) => api<{ orders: OrderView[] }>(`/api/orders?ids=${encodeURIComponent(myOrders.join(","))}`, { signal }),
    [myOrders.join(",")],
    { enabled: myOrders.length > 0 },
  );

  function find(e: FormEvent) {
    e.preventDefault();
    const id = lookup.trim().toUpperCase();
    if (!/^NX-\d{4}-\d{4}$/.test(id)) {
      setLookupError(`Order IDs look like NX-${year}-4821.`);
      return;
    }
    navigate(`/orders/${id}`);
  }

  return (
    <div className="container-page py-12">
      <PageHeader eyebrow="Order tracking" title="Track your order">
        Follow your {profile.id === "telecom" ? "installation" : "delivery"} live, step by step.
      </PageHeader>
      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <form onSubmit={find} className="card h-fit p-6" data-testid="order-lookup-form">
          <label htmlFor="order-id" className="label">
            Order ID
          </label>
          <input
            id="order-id"
            className="input font-mono uppercase"
            placeholder={`NX-${year}-4821`}
            value={lookup}
            onChange={(e) => {
              setLookup(e.target.value);
              setLookupError(undefined);
            }}
            aria-invalid={!!lookupError}
            data-testid="input-order-id"
          />
          {lookupError && (
            <p className="mt-1 text-sm text-rose-600" role="alert">
              {lookupError}
            </p>
          )}
          <button className="btn-dark mt-4 w-full" data-testid="btn-lookup-order">
            Track order
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Try the demo order{" "}
            <button type="button" className="font-mono text-accent underline" onClick={() => navigate(`/orders/NX-${year}-4821`)} data-testid="link-demo-order">
              NX-{year}-4821
            </button>
            .
          </p>
        </form>

        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-4 text-lg font-semibold">
            Orders placed on this device
          </h2>
          {myOrders.length === 0 ? (
            <div className="card p-8 text-center text-slate-600" data-testid="recent-orders-empty">
              <p>You haven't placed any orders yet.</p>
              <Link to="/catalog" className="btn-primary mt-4">
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="space-y-3" data-testid="recent-orders" data-state={recent.state}>
              {recent.state === "loading" && <li className="skeleton h-20" />}
              {recent.data?.orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-slate-300" data-testid={`recent-order-${o.id}`}>
                    <div>
                      <p className="font-mono font-semibold">{o.id}</p>
                      <p className="text-sm text-slate-600">
                        {o.lines.map((l) => l.name).join(", ")} · {ago(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-600">{o.currentMilestone}</span>
                      <StatusBadge status={o.status} />
                      <span className="font-semibold">{money(o.totals.total)}</span>
                      <Icon name="arrow" className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                </li>
              ))}
              {recent.state === "success" && recent.data?.orders.length === 0 && <li className="card p-6 text-sm text-slate-600">Your previous orders are no longer in this workspace (it may have been reset).</li>}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
