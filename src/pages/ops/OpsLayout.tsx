import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../../components/Layout";
import { cx } from "../../lib/format";
import { setWorkspace } from "../../lib/session";
import { useApp, useConfig } from "../../state/AppContext";

export const SCENARIO_TONE: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  slow_experience: "bg-amber-50 text-amber-800 ring-amber-600/20",
  checkout_failure: "bg-rose-50 text-rose-700 ring-rose-600/20",
  stalled_order: "bg-orange-50 text-orange-800 ring-orange-600/20",
};

export default function OpsLayout() {
  const config = useConfig();
  const { refreshConfig } = useApp();
  const [ws, setWs] = useState(config.workspace);
  // The console shows the workspace scenario (and its region), not just what this presenter experiences.
  const activeScenario = config.scenarioSource === "session" ? config.scenario : config.workspaceState.scenario;
  const region = config.workspaceState.scenarioRegion ?? "all";
  const scenarioLabel =
    (config.scenarios.find((s) => s.id === activeScenario)?.label ?? activeScenario) +
    (config.scenarioSource !== "session" && region !== "all" && activeScenario !== "healthy" ? (region === "uk" ? " · UK only" : " · Outside UK") : "");

  function switchWorkspace(e: FormEvent) {
    e.preventDefault();
    const id = ws.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) return;
    setWorkspace(id);
    // Full reload so every view (and the basket) re-reads the new workspace.
    location.reload();
  }

  const tabs = [
    { to: "/ops", label: "Service Health", end: true, testId: "ops-nav-health" },
    { to: "/ops/orders", label: "Order Operations", testId: "ops-nav-orders" },
    { to: "/ops/scenarios", label: "Scenario Controls", testId: "ops-nav-scenarios" },
  ];

  return (
    <div className="min-h-screen bg-surface" data-testid="ops-console">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-ink text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/ops" className="[&_span]:text-white" aria-label="Operations console home">
              <Logo sub="Operations Console" />
            </Link>
            <span className="hidden h-6 w-px bg-slate-700 sm:block" />
            <div className="hidden items-center gap-2 text-xs sm:flex">
              <span className="rounded-full bg-slate-800 px-2.5 py-1 font-medium" data-testid="ops-profile-chip">
                {config.profile.id === "telecom" ? "Telecom" : "Retail"} profile
              </span>
              <span className={cx("rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset", SCENARIO_TONE[activeScenario])} data-testid="ops-scenario-chip">
                {scenarioLabel}
                {config.scenarioSource === "session" ? " (session)" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <form onSubmit={switchWorkspace} className="flex items-center gap-2" aria-label="Switch workspace">
              <label htmlFor="ops-workspace" className="text-xs text-slate-400">
                Workspace
              </label>
              <input
                id="ops-workspace"
                value={ws}
                onChange={(e) => setWs(e.target.value)}
                className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white focus:border-indigo-400 focus:outline-none"
                data-testid="input-workspace"
              />
              {ws !== config.workspace && (
                <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold" data-testid="btn-switch-workspace">
                  Switch
                </button>
              )}
            </form>
            <Link to="/" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800" data-testid="ops-back-to-store">
              ← Storefront
            </Link>
          </div>
        </div>
        <nav className="container-page flex gap-1 overflow-x-auto" aria-label="Operations">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              data-testid={t.testId}
              onClick={() => void refreshConfig()}
              className={({ isActive }) => cx("border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition", isActive ? "border-indigo-400 text-white" : "border-transparent text-slate-400 hover:text-white")}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="container-page py-8">
        <Outlet />
      </main>
    </div>
  );
}
