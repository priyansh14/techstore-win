import { isProfileId, isScenarioId } from "../config/profiles";
import type { ProfileId, ScenarioId } from "../../shared/types";

const KEYS = { workspace: "nexora:workspace", scenario: "nexora:scenario", profile: "nexora:profile" } as const;
const COOKIES = { workspace: "nx_ws", scenario: "nx_scn", profile: "nx_prof" } as const;
type Key = keyof typeof KEYS;

function store(key: Key, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(KEYS[key]);
    else sessionStorage.setItem(KEYS[key], value);
  } catch {
    // Storage can be unavailable (private modes); cookies still carry the value.
  }
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    value === null
      ? `${COOKIES[key]}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${COOKIES[key]}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`;
}

function read(key: Key): string | null {
  try {
    const v = sessionStorage.getItem(KEYS[key]);
    if (v) return v;
  } catch {
    /* ignore */
  }
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIES[key]}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Reads ?workspace=, ?scenario= and ?profile= from the URL and pins them for this browser session.
 * `?scenario=default` / `?profile=default` clears a session override.
 */
export function syncSessionFromUrl(search = location.search) {
  const params = new URLSearchParams(search);
  const ws = params.get("workspace");
  if (ws !== null) store("workspace", /^[a-z0-9][a-z0-9-]{0,39}$/i.test(ws) && ws.toLowerCase() !== "public" ? ws.toLowerCase() : null);
  const scn = params.get("scenario");
  if (scn !== null) store("scenario", isScenarioId(scn) ? scn : null);
  const prof = params.get("profile");
  if (prof !== null) store("profile", isProfileId(prof) ? prof : null);
}

export const getWorkspace = () => read("workspace") ?? "public";
export const getScenarioOverride = (): ScenarioId | null => {
  const v = read("scenario");
  return isScenarioId(v) ? v : null;
};
export const getProfileOverride = (): ProfileId | null => {
  const v = read("profile");
  return isProfileId(v) ? v : null;
};
export const setWorkspace = (id: string | null) => store("workspace", id && id !== "public" ? id : null);
export const setScenarioOverride = (s: ScenarioId | null) => store("scenario", s);
export const setProfileOverride = (p: ProfileId | null) => store("profile", p);

export function sessionHeaders(): Record<string, string> {
  const h: Record<string, string> = { "X-Workspace-ID": getWorkspace() };
  const s = getScenarioOverride();
  const p = getProfileOverride();
  if (s) h["X-Nexora-Scenario"] = s;
  if (p) h["X-Nexora-Profile"] = p;
  return h;
}
