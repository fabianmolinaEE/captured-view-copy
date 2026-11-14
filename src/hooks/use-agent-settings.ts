import { useSyncExternalStore } from "react";
import {
  AGENT_SETTINGS_KEY,
  defaultAgentSettings,
  sanitizeAgentSettings,
  saveAgentSettings,
  updateScoutSettings,
  type AgentSettings,
  type ScoutId,
  type ScoutSettings,
} from "@/lib/research/agentSettings";

const change = "loopmate-agent-settings-change";
/** In-memory copy used when storage is unavailable (private window, blocked site data). */
let memory: AgentSettings | null = null;
/** True when the last save could not reach localStorage (e.g. quota); memory is then newer. */
let writeFailed = false;
let cache: { raw: string | null; value: AgentSettings } | null = null;

function snapshot(): AgentSettings {
  if (writeFailed && memory) return memory;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(AGENT_SETTINGS_KEY);
  } catch {
    return memory ?? defaultAgentSettings;
  }
  if (raw === null && memory) return memory;
  if (cache && cache.raw === raw) return cache.value;
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  cache = { raw, value: sanitizeAgentSettings(parsed) };
  return cache.value;
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === AGENT_SETTINGS_KEY || event.key === null) notify();
  };
  window.addEventListener(change, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(change, notify);
    window.removeEventListener("storage", storage);
  };
}
export function setAgentSettings(next: AgentSettings) {
  const clean = sanitizeAgentSettings(next);
  memory = clean;
  writeFailed = !saveAgentSettings(clean);
  window.dispatchEvent(new Event(change));
}
export function setScoutSettings(scout: ScoutId, patch: Partial<ScoutSettings>) {
  setAgentSettings(updateScoutSettings(snapshot(), scout, patch));
}
export function resetAgentSettings() {
  memory = null;
  writeFailed = false;
  try {
    window.localStorage.removeItem(AGENT_SETTINGS_KEY);
  } catch {
    /* Defaults apply in memory. */
  }
  cache = null;
  window.dispatchEvent(new Event(change));
}
/** SSR-safe: the server render and first hydration use defaults. */
export function useAgentSettings() {
  const settings = useSyncExternalStore(subscribe, snapshot, () => defaultAgentSettings);
  return {
    settings,
    setSettings: setAgentSettings,
    updateScout: setScoutSettings,
    reset: resetAgentSettings,
  };
}
