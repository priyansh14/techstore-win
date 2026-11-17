import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { cx } from "../lib/format";
import { setScenarioOverride } from "../lib/session";
import { useApp, useConfig } from "../state/AppContext";
import { Icon } from "./ui";

export function Logo({ sub }: { sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#0F172A" />
        <path d="M9 23V9h2.6l7.8 9.6V9H22v14h-2.6l-7.8-9.6V23z" fill="#fff" />
        <circle cx="24.5" cy="8" r="2.5" fill="#818CF8" />
      </svg>
      <span className="leading-none">
        <span className="block text-lg font-semibold tracking-tight">Nexora</span>
        {sub && <span className="block text-[11px] font-medium tracking-wide text-slate-500">{sub}</span>}
      </span>
    </span>
  );
}

function Header() {
  const { basketCount } = useApp();
  const { profile } = useConfig();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    { to: "/catalog", label: profile.id === "telecom" ? "Plans" : "Shop", testId: "nav-catalog" },
    { to: "/orders", label: "Track order", testId: "nav-orders" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Nexora home" data-testid="nav-home">
          <Logo sub={profile.brandLine} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={l.testId}
              className={({ isActive }) => cx("rounded-full px-4 py-2 text-sm font-medium transition", isActive ? "bg-slate-100 text-ink" : "text-slate-600 hover:text-ink")}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/basket" className="relative btn-ghost px-3.5" data-testid="nav-basket" aria-label={`Basket, ${basketCount} item${basketCount === 1 ? "" : "s"}`}>
            <Icon name="basket" />
            <span className="hidden sm:inline">Basket</span>
            {basketCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white" data-testid="basket-count">
                {basketCount}
              </span>
            )}
          </Link>
          <button className="btn-ghost px-3 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Toggle menu" data-testid="nav-menu-toggle">
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-line bg-white md:hidden" aria-label="Mobile">
          <div className="container-page flex flex-col py-2">
            {[{ to: "/", label: "Home", testId: "nav-mobile-home" }, ...links].map((l) => (
              <NavLink key={l.to} to={l.to} className="rounded-lg px-3 py-3 font-medium text-slate-700 hover:bg-slate-50" data-testid={`${l.testId}-mobile`}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function DemoBar() {
  return (
    <div className="bg-ink text-center text-xs text-slate-300" data-testid="demo-notice">
      <p className="container-page py-2">
        <span className="font-semibold text-white">Demo storefront.</span> Nexora is a fictional brand. No real orders, payments or deliveries are processed.
      </p>
    </div>
  );
}

function Footer() {
  const { config, refreshConfig } = useApp();
  const { profile } = useConfig();
  const sessionScenario = config?.scenarioSource === "session" && config.scenario !== "healthy" ? config.scenario : null;
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo sub={profile.brandLine} />
          <p className="mt-4 max-w-sm text-sm text-slate-600">
            {profile.id === "telecom"
              ? "Full-fiber broadband and business connectivity, engineered for uptime."
              : "Precision-built laptops, audio and networking, delivered fast."}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {profile.categories.map((c) => (
              <li key={c}>
                <Link to={`/catalog?category=${encodeURIComponent(c)}`} className="hover:text-ink">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Support</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <Link to="/orders" className="hover:text-ink">
                Track an order
              </Link>
            </li>
            <li>
              <Link to="/basket" className="hover:text-ink">
                Your basket
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Nexora (fictional demo brand). Built for experience-monitoring demonstrations.</p>
          <div className="flex items-center gap-4">
            {sessionScenario && (
              <button
                className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-amber-200"
                data-testid="session-scenario-chip"
                onClick={() => {
                  setScenarioOverride(null);
                  void refreshConfig();
                }}
                title="Scenario pinned for this browser session. Click to clear."
              >
                Scenario: {sessionScenario} ✕
              </button>
            )}
            <Link to="/ops" className="text-slate-400 hover:text-slate-600" data-testid="footer-presenter-console">
              Presenter Console
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <DemoBar />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
