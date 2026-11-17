import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export type AsyncState = "idle" | "loading" | "success" | "error";

export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: DependencyList, opts: { enabled?: boolean } = {}) {
  const [data, setData] = useState<T>();
  const [state, setState] = useState<AsyncState>("idle");
  const [error, setError] = useState<Error>();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const enabled = opts.enabled ?? true;
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(
    (silent = false) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      if (!silent) setState("loading");
      return fnRef
        .current(c.signal)
        .then((d) => {
          if (c.signal.aborted) return;
          setData(d);
          setError(undefined);
          setState("success");
        })
        .catch((e: Error) => {
          if (c.signal.aborted || e.name === "AbortError") return;
          setError(e);
          setState("error");
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    if (enabled) void run();
    return () => ctrl.current?.abort();
  }, [run, enabled]);

  return { data, state, error, reload: run, setData };
}
