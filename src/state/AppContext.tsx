import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BasketLine, ConfigResponse } from "../../shared/types";
import { api } from "../lib/api";
import { getWorkspace } from "../lib/session";

type LoadState = "idle" | "loading" | "success" | "error";

interface AppValue {
  config: ConfigResponse | null;
  configState: LoadState;
  configError?: string;
  refreshConfig: () => Promise<void>;
  basket: BasketLine[];
  basketCount: number;
  addToBasket: (line: BasketLine) => void;
  setQty: (index: number, qty: number) => void;
  removeLine: (index: number) => void;
  clearBasket: () => void;
  myOrders: string[];
  rememberOrder: (id: string) => void;
}

const AppContext = createContext<AppValue | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled */
  }
}

const sameLine = (a: BasketLine, b: BasketLine) =>
  a.slug === b.slug && a.variantId === b.variantId && [...a.addOnIds].sort().join() === [...b.addOnIds].sort().join();

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [configState, setConfigState] = useState<LoadState>("idle");
  const [configError, setConfigError] = useState<string>();
  const inflight = useRef<Promise<void> | null>(null);

  const refreshConfig = useCallback(() => {
    if (inflight.current) return inflight.current;
    setConfigState((s) => (s === "success" ? s : "loading"));
    inflight.current = api<ConfigResponse>("/api/config")
      .then((c) => {
        setConfig(c);
        setConfigState("success");
        setConfigError(undefined);
        document.documentElement.dataset.profile = c.profile.id;
        document.documentElement.dataset.scenario = c.scenario;
      })
      .catch((e: Error) => {
        setConfigError(e.message);
        setConfigState((s) => (s === "success" ? s : "error"));
      })
      .finally(() => {
        inflight.current = null;
      });
    return inflight.current;
  }, []);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const workspace = config?.workspace ?? getWorkspace();
  const profileId = config?.profile.id;
  const basketKey = profileId ? `nexora:basket:${workspace}:${profileId}` : null;
  const ordersKey = `nexora:orders:${workspace}`;

  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [myOrders, setMyOrders] = useState<string[]>([]);

  useEffect(() => {
    if (basketKey) setBasket(loadJson<BasketLine[]>(basketKey, []));
  }, [basketKey]);
  useEffect(() => {
    setMyOrders(loadJson<string[]>(ordersKey, []));
  }, [ordersKey]);

  const updateBasket = useCallback(
    (fn: (b: BasketLine[]) => BasketLine[]) => {
      setBasket((prev) => {
        const next = fn(prev);
        if (basketKey) saveJson(basketKey, next);
        return next;
      });
    },
    [basketKey],
  );

  const value = useMemo<AppValue>(
    () => ({
      config,
      configState,
      configError,
      refreshConfig,
      basket,
      basketCount: basket.reduce((s, l) => s + l.qty, 0),
      addToBasket: (line) =>
        updateBasket((b) => {
          const i = b.findIndex((l) => sameLine(l, line));
          if (i === -1) return [...b, line];
          return b.map((l, j) => (j === i ? { ...l, qty: Math.min(10, l.qty + line.qty) } : l));
        }),
      setQty: (index, qty) => updateBasket((b) => b.map((l, i) => (i === index ? { ...l, qty: Math.max(1, Math.min(10, qty)) } : l))),
      removeLine: (index) => updateBasket((b) => b.filter((_, i) => i !== index)),
      clearBasket: () => updateBasket(() => []),
      myOrders,
      rememberOrder: (id) =>
        setMyOrders((prev) => {
          const next = [id, ...prev.filter((x) => x !== id)].slice(0, 20);
          saveJson(ordersKey, next);
          return next;
        }),
    }),
    [config, configState, configError, refreshConfig, basket, updateBasket, myOrders, ordersKey],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/** Config is guaranteed once the shell has rendered children. */
export function useConfig(): ConfigResponse {
  const { config } = useApp();
  if (!config) throw new Error("Config not loaded");
  return config;
}
