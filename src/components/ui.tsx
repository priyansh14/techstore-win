import type { ReactNode } from "react";
import type { OrderStatus } from "../../shared/types";
import { cx, money } from "../lib/format";

export function Price({ amount, suffix, className }: { amount: number; suffix?: string; className?: string }) {
  return (
    <span className={className}>
      {money(amount)}
      {suffix ? <span className="text-sm font-normal text-slate-500">{suffix}</span> : null}
    </span>
  );
}

export function Stars({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500" aria-label={`Rated ${rating} out of 5 from ${reviews} reviews`}>
      <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" className="text-amber-400">
        <path fill="currentColor" d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
      <span className="font-semibold text-slate-700">{rating.toFixed(1)}</span>
      <span>({reviews.toLocaleString()})</span>
    </span>
  );
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  stalled: "bg-rose-50 text-rose-700 ring-rose-600/20",
};
const STATUS_LABEL: Record<OrderStatus, string> = { completed: "Completed", in_progress: "In Progress", stalled: "Stalled" };

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", STATUS_STYLES[status])}
      data-testid="order-status-badge"
      data-status={status}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", status === "completed" ? "bg-emerald-500" : status === "stalled" ? "bg-rose-500" : "bg-indigo-500 animate-pulse")} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Banner({ tone, title, children, testId, action }: { tone: "error" | "success" | "info" | "warning"; title: string; children?: ReactNode; testId?: string; action?: ReactNode }) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-indigo-200 bg-indigo-50 text-indigo-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between", styles)} data-testid={testId}>
      <div>
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-1 text-sm opacity-90">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {children ? <div className="mt-3 max-w-2xl text-slate-600">{children}</div> : null}
    </div>
  );
}

export function Icon({ name, className = "h-5 w-5" }: { name: "basket" | "check" | "arrow" | "menu" | "close" | "truck" | "shield" | "bolt" | "clock" | "search" | "plus" | "minus" | "trash" | "x" | "pin" | "alert"; className?: string }) {
  const paths: Record<string, ReactNode> = {
    basket: <path d="M3 6h18l-2 12H5L3 6zm5 0V5a4 4 0 0 1 8 0v1" />,
    check: <path d="M5 12l5 5L20 7" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    truck: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
    clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
    search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />,
    pin: <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
    alert: <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
