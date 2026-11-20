import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Link, matchPath, Route, Routes, useLocation } from "react-router-dom";
import { StoreLayout } from "./components/Layout";
import { Banner, Spinner } from "./components/ui";
import { rum, RUM_TOKENS, type PageGroupToken } from "./lib/rumBridge";
import { syncSessionFromUrl } from "./lib/session";
import { emitPageEvent } from "./lib/vendors";
import Basket from "./pages/Basket";
import Catalog from "./pages/Catalog";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import Product from "./pages/Product";
import { AppProvider, useApp } from "./state/AppContext";

const OpsLayout = lazy(() => import("./pages/ops/OpsLayout"));
const OpsHealth = lazy(() => import("./pages/ops/OpsHealth"));
const OpsOrders = lazy(() => import("./pages/ops/OpsOrders"));
const OpsScenarios = lazy(() => import("./pages/ops/OpsScenarios"));

const PAGE_GROUPS: [string, PageGroupToken][] = [
  ["/", "home"],
  ["/catalog", "catalog"],
  ["/product/:slug", "productdetail"],
  ["/basket", "basket"],
  ["/checkout", "checkout"],
  ["/orders", "orderlookup"],
  ["/orders/:orderId", "ordertracker"],
  ["/ops", "opshealth"],
  ["/ops/orders", "opsorders"],
  ["/ops/scenarios", "opsscenarios"],
];

const TRAFFIC_SOURCE = typeof navigator !== "undefined" && navigator.webdriver ? "automation" : "human";

function RouteEffects() {
  const location = useLocation();
  const { refreshConfig, config } = useApp();
  useEffect(() => {
    syncSessionFromUrl(location.search);
    const group = PAGE_GROUPS.find(([p]) => matchPath(p, location.pathname))?.[1] ?? "notfound";
    const label = RUM_TOKENS.pageGroups[group];
    rum.mark("route-change", { path: location.pathname });
    document.title = group.startsWith("ops") ? `${label.replace("Ops ", "")} · Nexora Ops` : group === "home" ? "Nexora: Fiber, Connectivity & Devices" : `${label} · Nexora`;
    window.scrollTo({ top: 0 });
    void refreshConfig();
  }, [location.pathname, location.search, refreshConfig]);

  // Page-level RUM context is re-sent on every hard and soft navigation, once config is known.
  // Deferred a tick so the RUM tag has registered the soft navigation first.
  useEffect(() => {
    if (!config) return;
    const t = setTimeout(() => {
      const group = PAGE_GROUPS.find(([p]) => matchPath(p, location.pathname))?.[1] ?? "notfound";
      rum.pageGroup(group);
      emitPageEvent("pageview", { group, path: location.pathname, profile: config.profile.id });
      rum.variation(config.profile.id);
      rum.tracepoint("scenario", config.scenario);
      rum.tracepoint("workspace", config.workspace);
      rum.tracepoint("trafficsrc", TRAFFIC_SOURCE);
    }, 0);
    return () => clearTimeout(t);
  }, [location.pathname, config?.profile.id, config?.scenario, config?.workspace]);
  return null;
}

function Shell() {
  const { config, configState, configError, refreshConfig } = useApp();
  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" data-testid="app-loading" data-state={configState}>
        {configState === "error" ? (
          <div className="max-w-md">
            <Banner tone="error" title="Nexora is temporarily unavailable" action={<button className="btn-dark" onClick={() => refreshConfig()}>Retry</button>}>
              {configError}
            </Banner>
          </div>
        ) : (
          <Spinner className="h-6 w-6 text-accent" />
        )}
      </div>
    );
  }
  return (
    <>
      <RouteEffects />
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner className="h-6 w-6 text-accent" /></div>}>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="product/:slug" element={<Product />} />
            <Route path="basket" element={<Basket />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:orderId" element={<OrderDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="ops" element={<OpsLayout />}>
            <Route index element={<OpsHealth />} />
            <Route path="orders" element={<OpsOrders />} />
            <Route path="scenarios" element={<OpsScenarios />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

function NotFound() {
  return (
    <div className="container-page py-24 text-center" data-testid="not-found">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn't find that page</h1>
      <Link to="/" className="btn-primary mt-6">
        Back to Nexora
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Shell />
      </AppProvider>
    </BrowserRouter>
  );
}
