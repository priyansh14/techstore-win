import { useState } from "react";
import type { ProfileId, ScenarioId, WorkspaceSnapshot } from "../../../shared/types";
import { Banner, Icon, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { cx } from "../../lib/format";
import { setProfileOverride, setScenarioOverride } from "../../lib/session";
import { useApp, useConfig } from "../../state/AppContext";
import { SCENARIO_TONE } from "./OpsLayout";

type Busy = null | "profile" | "reset" | "seed" | ScenarioId;

export default function OpsScenarios() {
  const config = useConfig();
  const { refreshConfig } = useApp();
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string }>();
  const ws = config.workspaceState;

  async function post(body: Record<string, string>, label: Busy, success: string) {
    setBusy(label);
    setMsg(undefined);
    try {
      await api<{ workspace: WorkspaceSnapshot }>("/api/scenarios", { method: "POST", body });
      await refreshConfig();
      setMsg({ tone: "success", text: success });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const setProfile = (p: ProfileId) => {
    setProfileOverride(null);
    void post({ action: "set", profile: p }, "profile", `Workspace switched to the ${p === "telecom" ? "Telecom" : "Retail"} profile.`);
  };
  const setScenario = (s: ScenarioId) => {
    setScenarioOverride(null);
    void post({ action: "set", scenario: s }, s, `Scenario set to ${config.scenarios.find((x) => x.id === s)?.label}.`);
  };

  const origin = typeof location !== "undefined" ? location.origin : "";
  const wsParam = config.workspace === "public" ? "" : `&workspace=${config.workspace}`;

  return (
    <div className="space-y-8" data-testid="ops-scenarios">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scenario Controls</h1>
          <p className="mt-1 text-sm text-slate-600">
            Workspace <span className="font-mono font-semibold text-ink">{config.workspace}</span> · {ws.orderCount} orders
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => post({ action: "seed" }, "seed", "Demo orders seeded: completed, in-progress and stalled.")} disabled={!!busy} data-testid="btn-seed-orders">
            {busy === "seed" ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />} Seed Demo Orders
          </button>
          <button
            className="btn border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            onClick={() => {
              setScenarioOverride(null);
              void post({ action: "reset" }, "reset", "Workspace reset: orders cleared, scenario set to Healthy.");
            }}
            disabled={!!busy}
            data-testid="btn-reset-workspace"
          >
            {busy === "reset" ? <Spinner /> : <Icon name="trash" className="h-4 w-4" />} Reset Workspace
          </button>
        </div>
      </div>

      {msg && <Banner tone={msg.tone} title={msg.text} testId="ops-scenario-message" />}
      {config.workspace === "public" && (
        <Banner tone="info" title="You're controlling the shared public workspace">
          Everyone visiting the storefront sees these changes. Non-healthy scenarios here revert to Healthy automatically after 20 minutes. For private demos, switch to your own workspace (top right) or open the storefront with{" "}
          <code className="font-mono">?workspace=your-name</code>.
        </Banner>
      )}
      {config.scenarioSource === "session" && (
        <Banner
          tone="warning"
          title={`This browser has a session scenario override: ${config.scenario}`}
          action={
            <button
              className="btn-ghost"
              onClick={() => {
                setScenarioOverride(null);
                void refreshConfig();
              }}
            >
              Clear override
            </button>
          }
        >
          A <code className="font-mono">?scenario=</code> URL parameter pinned this scenario for your session only. It takes precedence over the workspace setting below.
        </Banner>
      )}

      <section className="card p-6" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="font-semibold">
          Store profile
        </h2>
        <p className="mt-1 text-sm text-slate-600">Switches catalog, checkout fields and order milestones for this workspace.</p>
        <div className="mt-4 inline-flex rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Store profile">
          {(["telecom", "retail"] as const).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={ws.profile === p}
              onClick={() => setProfile(p)}
              disabled={!!busy}
              data-testid={`btn-profile-${p}`}
              className={cx("rounded-full px-5 py-2 text-sm font-semibold transition", ws.profile === p ? "bg-ink text-white shadow" : "text-slate-600 hover:text-ink")}
            >
              {p === "telecom" ? "Telecom: Fiber & Connectivity" : "Retail: Devices & Hardware"}
            </button>
          ))}
        </div>
        {config.profileSource === "session" && <p className="mt-2 text-xs text-amber-700">This browser is pinned to the {config.profile.id} profile by a ?profile= URL parameter.</p>}
      </section>

      <section aria-labelledby="scenario-heading">
        <h2 id="scenario-heading" className="mb-4 font-semibold">
          Scenario
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {config.scenarios.map((s) => {
            const active = ws.scenario === s.id;
            return (
              <article key={s.id} className={cx("card flex flex-col p-6 transition", active && "ring-2 ring-accent")} data-testid={`scenario-card-${s.id}`} data-active={active}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", SCENARIO_TONE[s.id])}>{s.label}</span>
                    <p className="mt-3 font-medium">{s.summary}</p>
                  </div>
                  {active && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">Active</span>}
                </div>
                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Customer experience</p>
                    <p className="mt-1 text-slate-600">{s.customerExperience}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Telemetry signals</p>
                    <ul className="mt-1 space-y-1 text-slate-600">
                      {s.telemetrySignals.map((t) => (
                        <li key={t} className="flex gap-1.5">
                          <span className="text-accent">•</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <code className="truncate font-mono text-xs text-slate-500" title="Synthetic monitors can pin this scenario per session with this URL">
                    {origin}/?scenario={s.id}
                    {wsParam}
                  </code>
                  <button className={active ? "btn-ghost" : "btn-dark"} onClick={() => setScenario(s.id)} disabled={!!busy || active} data-testid={`btn-activate-${s.id}`}>
                    {busy === s.id ? <Spinner /> : null}
                    {active ? "Active" : "Activate"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
