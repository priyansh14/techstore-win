import type { MilestoneState, OrderView } from "../../shared/types";
import { cx, time } from "../lib/format";
import { Icon } from "./ui";

export function MilestoneTimeline({ order }: { order: OrderView }) {
  return (
    <ol className="relative" data-testid="milestone-timeline" data-status={order.status} data-completed={order.completedStages}>
      {order.milestones.map((m, i) => (
        <Step key={m.key} m={m} index={i} last={i === order.milestones.length - 1} stallReason={m.state === "failed" ? order.stall?.reason : undefined} />
      ))}
    </ol>
  );
}

function Step({ m, index, last, stallReason }: { m: MilestoneState; index: number; last: boolean; stallReason?: string }) {
  const dot = {
    done: "bg-emerald-500 text-white ring-emerald-100",
    current: "bg-white text-accent ring-indigo-100 border-2 border-accent",
    pending: "bg-white text-slate-400 ring-slate-100 border-2 border-slate-200",
    failed: "bg-rose-500 text-white ring-rose-100",
  }[m.state];
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0" data-testid={`milestone-${index + 1}`} data-state={m.state} data-milestone={m.key}>
      {!last && <span className={cx("absolute top-9 left-[17px] h-[calc(100%-2.25rem)] w-0.5", m.state === "done" ? "bg-emerald-300" : "bg-slate-200")} aria-hidden="true" />}
      <span className={cx("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-4", dot)}>
        {m.state === "done" ? (
          <Icon name="check" className="h-4 w-4" />
        ) : m.state === "failed" ? (
          <Icon name="x" className="h-4 w-4" />
        ) : m.state === "current" ? (
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        ) : (
          index + 1
        )}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cx("font-semibold", m.state === "pending" && "text-slate-400", m.state === "failed" && "text-rose-700")}>{m.label}</p>
          <p className="font-mono text-xs text-slate-500" data-testid={`milestone-${index + 1}-time`}>
            {m.at ? time(m.at) : m.state === "current" ? "In progress…" : ""}
          </p>
        </div>
        <p className={cx("text-sm", m.state === "pending" ? "text-slate-400" : "text-slate-600")}>{m.description}</p>
        {stallReason && (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" data-testid="milestone-stall-reason">
            <strong>On hold:</strong> {stallReason}
          </p>
        )}
      </div>
    </li>
  );
}
