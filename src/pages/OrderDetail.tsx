import { useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PROFILES } from "../../shared/profiles";
import type { OrderView } from "../../shared/types";
import { MilestoneTimeline } from "../components/MilestoneTimeline";
import { ProductIllustration } from "../components/ProductIllustration";
import { Banner, Icon, StatusBadge } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { dateTime, money } from "../lib/format";
import { rum } from "../lib/rumBridge";
import { useAsync } from "../lib/useAsync";

const POLL_MS = 3000;

export default function OrderDetail() {
  const { orderId = "" } = useParams();
  const [params] = useSearchParams();
  const placed = params.get("placed") === "1";
  const res = useAsync((signal) => api<{ order: OrderView }>(`/api/orders/${encodeURIComponent(orderId)}`, { signal }), [orderId]);
  const order = res.data?.order;
  const reported = useRef<string>("");

  useEffect(() => {
    if (!order || order.status === "completed") return;
    const t = setInterval(() => void res.reload(true), POLL_MS);
    return () => clearInterval(t);
  }, [order?.status, order?.id]);

  useEffect(() => {
    if (!order) return;
    const key = `${order.id}:${order.status}:${order.completedStages}`;
    if (reported.current === key) return;
    reported.current = key;
    rum.tracepoint("orderid", order.id);
  }, [order]);

  if (res.state === "loading" || (res.state === "idle" && !order)) {
    return (
      <div className="container-page py-12" aria-busy="true" data-testid="order-loading">
        <div className="skeleton mb-4 h-10 w-72" />
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="skeleton h-96" />
          <div className="skeleton h-64" />
        </div>
      </div>
    );
  }
  if (!order) {
    const notFound = res.error instanceof ApiError && res.error.status === 404;
    return (
      <div className="container-page py-16">
        <Banner
          tone={notFound ? "warning" : "error"}
          title={notFound ? "Order not found" : "We couldn't load this order"}
          testId="order-error"
          action={
            <Link to="/orders" className="btn-ghost">
              Back to tracking
            </Link>
          }
        >
          {res.error?.message}
        </Banner>
      </div>
    );
  }

  const profile = PROFILES[order.profile];
  const slot = profile.journey.slotOptions.find((o) => o.value === order.journey.slot)?.label;
  const pref = profile.journey.preferenceOptions.find((o) => o.value === order.journey.preference)?.label;

  return (
    <div className="container-page py-12" data-testid="order-detail" data-order-id={order.id} data-status={order.status} data-state={res.state}>
      {placed && (
        <div className="mb-8">
          <Banner tone="success" title="Thank you, your order is confirmed!" testId="order-confirmation">
            We've emailed a confirmation to <span className="rr-mask">{order.customer.email}</span>. Keep this page open to watch your order progress live.
          </Banner>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{profile.label}</p>
          <h1 className="font-mono text-3xl font-semibold tracking-tight" data-testid="order-id">
            {order.id}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Placed {dateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          {order.status !== "completed" && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500" data-testid="live-indicator">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live, updates every 3 s
            </span>
          )}
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="card p-6 sm:p-8" aria-labelledby="progress-heading">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 id="progress-heading" className="text-lg font-semibold">
              Progress
            </h2>
            <span className="text-sm text-slate-500" data-testid="order-current-milestone">
              {order.completedStages}/6 · {order.currentMilestone}
            </span>
          </div>
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={order.completedStages} aria-label="Order progress">
            <div
              className={`h-full rounded-full transition-all duration-700 ${order.status === "stalled" ? "bg-rose-500" : order.status === "completed" ? "bg-emerald-500" : "bg-accent"}`}
              style={{ width: `${(order.completedStages / 6) * 100}%` }}
            />
          </div>
          {order.status === "stalled" && (
            <div className="mb-6">
              <Banner tone="warning" title="Your order is on hold" testId="order-stalled-banner">
                We hit a problem at “{order.currentMilestone}”. Our team has been alerted and will resume your order shortly. No action is needed from you.
              </Banner>
            </div>
          )}
          {order.status === "completed" && (
            <div className="mb-6">
              <Banner tone="success" title={order.profile === "telecom" ? "Your service is live" : "Delivered"} testId="order-completed-banner">
                {order.profile === "telecom" ? "Welcome to Nexora Fiber. Your connection is active." : "Your order has been delivered. Enjoy!"}
              </Banner>
            </div>
          )}
          <MilestoneTimeline order={order} />
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold">Items</h2>
            <ul className="mt-4 space-y-4">
              {order.lines.map((l) => (
                <li key={`${l.slug}-${l.variantId}`} className="flex gap-3">
                  <div className="w-20 shrink-0 overflow-hidden rounded-lg border border-line">
                    <ProductIllustration slug={l.slug} label={l.name} width={80} height={50} className="w-full" />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {l.qty} × {l.name}
                    </p>
                    <p className="text-xs text-slate-500">{[l.variantLabel, ...l.addOnNames].join(" · ")}</p>
                  </div>
                  <span className="text-sm font-medium">{money(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              {order.totals.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Discount ({order.promoCode})</dt>
                  <dd>−{money(order.totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">Tax</dt>
                <dd>{money(order.totals.tax)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd data-testid="order-total">{money(order.totals.total)}</dd>
              </div>
            </dl>
          </div>
          <div className="card rr-mask p-6 text-sm" data-rum-mask="customer-details">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 space-y-2 text-slate-600">
              <div>
                <dt className="text-xs text-slate-400">Customer</dt>
                <dd>
                  {order.customer.fullName} · {order.customer.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{profile.journey.addressLabel}</dt>
                <dd>
                  {order.address.city}, {order.address.postcode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{profile.journey.slotLabel}</dt>
                <dd>{slot}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{profile.journey.preferenceLabel}</dt>
                <dd>{pref}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Payment</dt>
                <dd>
                  {order.payment.brand} ending {order.payment.last4}
                </dd>
              </div>
            </dl>
          </div>
          <Link to="/catalog" className="btn-ghost w-full">
            Continue shopping <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
