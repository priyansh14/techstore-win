import { rum } from "./rumBridge";
import { sessionHeaders } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const started = performance.now();
  const name = `${init.method ?? "GET"} ${path.split("?")[0]}`;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: { ...sessionHeaders(), ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "We couldn't reach Nexora. Check your connection and try again.");
  }
  const ms = performance.now() - started;
  rum.indicator(`api:${name}`, ms);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    rum.tracepoint("apiError", `${res.status} ${e?.code ?? "UNKNOWN"} ${name}`);
    throw new ApiError(res.status, e?.code ?? "HTTP_ERROR", e?.message ?? `Request failed (${res.status})`, e?.fields);
  }
  return data as T;
}
