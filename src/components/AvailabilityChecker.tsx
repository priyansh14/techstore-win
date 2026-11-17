import { useState, type FormEvent } from "react";
import type { Availability } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { cx } from "../lib/format";
import { rum } from "../lib/rumBridge";
import { useConfig } from "../state/AppContext";
import { Icon, Spinner } from "./ui";

type Result = Availability & { latencyMs: number };
type State = "idle" | "loading" | "success" | "error";

export function AvailabilityChecker({
  variant = "full",
  onResult,
  initialPostcode = "",
}: {
  variant?: "full" | "hero";
  onResult?: (r: Result | null) => void;
  initialPostcode?: string;
}) {
  const { profile } = useConfig();
  const [postcode, setPostcode] = useState(initialPostcode);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string>();
  const [clientMs, setClientMs] = useState<number>();

  async function check(e: FormEvent) {
    e.preventDefault();
    const value = postcode.trim();
    if (!value) {
      setError("Enter a postcode or PIN to check.");
      setState("error");
      return;
    }
    setState("loading");
    setError(undefined);
    onResult?.(null);
    rum.mark("availability:start");
    const t = performance.now();
    try {
      const r = await api<Result>(`/api/availability?postcode=${encodeURIComponent(value)}`);
      const ms = Math.round(performance.now() - t);
      rum.mark("availability:end");
      rum.measure("availability-check", "availability:start", "availability:end");
      rum.indicator("availabilityCheckMs", ms);
      rum.tracepoint("availabilityResult", r.available ? "available" : "unavailable");
      setClientMs(ms);
      setResult(r);
      setState("success");
      onResult?.(r);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Availability check failed. Please try again.");
      setState("error");
    }
  }

  const hero = variant === "hero";
  return (
    <div className={cx(hero ? "" : "card p-5")} data-testid="availability-checker" data-state={state}>
      {!hero && (
        <div className="mb-3 flex items-center gap-2">
          <Icon name="pin" className="h-5 w-5 text-accent" />
          <h2 className="font-semibold">{profile.availability.title}</h2>
        </div>
      )}
      <form onSubmit={check} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <label htmlFor={`postcode-${variant}`} className="sr-only">
          {profile.availability.inputLabel}
        </label>
        <input
          id={`postcode-${variant}`}
          data-testid="input-postcode"
          className={cx("input", hero && "h-12 rounded-full px-5")}
          placeholder={profile.availability.placeholder}
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          autoComplete="postal-code"
          inputMode="text"
          aria-invalid={state === "error"}
          aria-describedby={`availability-msg-${variant}`}
        />
        <button
          type="submit"
          id={`btn-check-availability-${variant}`}
          data-testid="btn-check-availability"
          data-state={state}
          className={cx(hero ? "btn-primary h-12 px-6" : "btn-dark", "shrink-0")}
          disabled={state === "loading"}
        >
          {state === "loading" ? <Spinner /> : <Icon name="search" className="h-4 w-4" />}
          {state === "loading" ? "Checking…" : "Check availability"}
        </button>
      </form>
      <div id={`availability-msg-${variant}`} aria-live="polite" className="mt-3">
        {state === "loading" && (
          <p className="text-sm text-slate-500" data-testid="availability-loading">
            Checking {profile.availability.hubNoun.toLowerCase()} capacity for {postcode.trim().toUpperCase()}…
          </p>
        )}
        {state === "error" && error && (
          <p className="text-sm font-medium text-rose-600" data-testid="availability-error">
            {error}
          </p>
        )}
        {state === "success" && result && (
          <div
            data-testid="availability-result"
            data-available={result.available}
            className={cx("rounded-xl border p-4 text-sm", result.available ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70", hero && "text-left")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cx("flex items-center gap-1.5 font-semibold", result.available ? "text-emerald-800" : "text-amber-800")}>
                <Icon name={result.available ? "check" : "alert"} className="h-4 w-4" />
                {result.status} · {result.postcode}
              </p>
              <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-xs text-slate-600" data-testid="availability-latency" title="Round-trip time measured in your browser">
                {clientMs ?? result.latencyMs} ms
              </span>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="inline text-slate-500">{profile.availability.hubNoun}: </dt>
                <dd className="inline" data-testid="availability-hub">
                  {result.hub.name} ({result.hub.code})
                </dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Distance: </dt>
                <dd className="inline">{result.distanceKm} km</dd>
              </div>
              <div className="sm:col-span-2">{result.detail}</div>
              <div className="font-medium sm:col-span-2">{result.eta}</div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
