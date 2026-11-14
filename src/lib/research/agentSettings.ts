import { isCompetitorSession } from "./competitors";
import { agentFocusAreas, isAgentFocus, type AgentFocus, type Session } from "./types";

/**
 * NOTE: identical to `ScoutId` exported by `./scouts` (owned by the mascot work). Kept local so
 * this module has no dependency on presentation metadata; the unions must stay in sync.
 */
export type ScoutId = "tracker" | "explorer" | "fixer" | "experimenter";
export const scoutIds = ["tracker", "explorer", "fixer", "experimenter"] as const;
/** Scouts that run Gemini insight analysis and accept focus areas. */
export type FindingScout = "tracker" | "explorer";
export const cadences = ["manual", "hourly", "daily", "weekly"] as const;
export type Cadence = (typeof cadences)[number];
export const cadenceLabels: Record<Cadence, string> = {
  manual: "Manual only",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
};
/** Shown next to any cadence: there is no background runner in the prototype. */
export const RUNNER_NOT_CONNECTED = "Runner not connected in prototype";

export interface ScoutSettings {
  enabled: boolean;
  /** Prompt emphasis (tracker/explorer only; always [] for fixer/experimenter). */
  focus_areas: AgentFocus[];
  /** 0..1. Findings below it are hidden from Insights by default (still stored). */
  min_confidence: number;
  /** Usage cap for real analyses per local calendar day (tracker/explorer). */
  max_analyses_per_day: number;
  /** Label only; no runner is connected. */
  cadence: Cadence;
}
export type AgentSettings = Record<ScoutId, ScoutSettings>;

export const AGENT_SETTINGS_KEY = "loopmate-agent-settings";
export const MAX_ANALYSES_LIMIT = 200;

const base: ScoutSettings = {
  enabled: true,
  focus_areas: [],
  min_confidence: 0,
  max_analyses_per_day: 20,
  cadence: "daily",
};
export const defaultAgentSettings: AgentSettings = {
  tracker: { ...base },
  explorer: { ...base, max_analyses_per_day: 10, cadence: "weekly" },
  fixer: { ...base, cadence: "manual" },
  experimenter: { ...base, cadence: "manual" },
};
export const usesFocusAreas = (scout: ScoutId): scout is FindingScout =>
  scout === "tracker" || scout === "explorer";

function sanitizeScout(scout: ScoutId, raw: unknown): ScoutSettings {
  const fallback = defaultAgentSettings[scout];
  if (!raw || typeof raw !== "object") return { ...fallback, focus_areas: [] };
  const value = raw as Record<string, unknown>;
  const focus = Array.isArray(value["focus_areas"])
    ? value["focus_areas"].filter(isAgentFocus)
    : [];
  const confidence = Number(value["min_confidence"]);
  const max = Number(value["max_analyses_per_day"]);
  const cadence = value["cadence"];
  return {
    enabled: typeof value["enabled"] === "boolean" ? value["enabled"] : fallback.enabled,
    focus_areas: usesFocusAreas(scout) ? agentFocusAreas.filter((a) => focus.includes(a)) : [],
    min_confidence:
      Number.isFinite(confidence) && value["min_confidence"] !== null
        ? Math.min(1, Math.max(0, confidence))
        : fallback.min_confidence,
    max_analyses_per_day:
      Number.isFinite(max) && value["max_analyses_per_day"] !== null
        ? Math.min(MAX_ANALYSES_LIMIT, Math.max(0, Math.round(max)))
        : fallback.max_analyses_per_day,
    cadence: (cadences as readonly unknown[]).includes(cadence)
      ? (cadence as Cadence)
      : fallback.cadence,
  };
}
/** Accepts any stored value; unknown keys are dropped and invalid values fall back to defaults. */
export function sanitizeAgentSettings(raw: unknown): AgentSettings {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    scoutIds.map((id) => [id, sanitizeScout(id, value[id])]),
  ) as AgentSettings;
}
export function loadAgentSettings(): AgentSettings {
  try {
    const stored = window.localStorage.getItem(AGENT_SETTINGS_KEY);
    return sanitizeAgentSettings(stored ? JSON.parse(stored) : undefined);
  } catch {
    return sanitizeAgentSettings(undefined);
  }
}
/** Returns false when storage is unavailable; the caller keeps the in-memory value. */
export function saveAgentSettings(settings: AgentSettings): boolean {
  try {
    window.localStorage.setItem(
      AGENT_SETTINGS_KEY,
      JSON.stringify(sanitizeAgentSettings(settings)),
    );
    return true;
  } catch {
    return false;
  }
}
export function updateScoutSettings(
  settings: AgentSettings,
  scout: ScoutId,
  patch: Partial<ScoutSettings>,
): AgentSettings {
  return sanitizeAgentSettings({ ...settings, [scout]: { ...settings[scout], ...patch } });
}

/** Tracker analyzes own-product footage; Explorer analyzes competitor footage. */
export const scoutForSession = (session: Session): FindingScout =>
  isCompetitorSession(session) ? "explorer" : "tracker";

const sameLocalDay = (iso: string, now: Date) => {
  const date = new Date(iso);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};
/**
 * Real stored analysis runs that reached the provider (completed runs, and failed runs not marked
 * `reached_provider: false`) started on the current local day. With `scout`, counts only that
 * scout's sessions. Simulated runs are never sessions and are never counted. Pre-generated runs
 * imported into this browser (`session.pregenerated.run_ids`) were not spent here and are never counted.
 */
export function analysesToday(sessions: Session[], now: Date = new Date(), scout?: FindingScout) {
  return sessions
    .filter((session) => !scout || scoutForSession(session) === scout)
    .reduce(
      (n, session) =>
        n +
        session.runs.filter(
          (run) =>
            run.reached_provider !== false &&
            !session.pregenerated?.run_ids.includes(run.id) &&
            sameLocalDay(run.started_at, now),
        ).length,
      0,
    );
}
export interface UsageCapStatus {
  scout: FindingScout;
  used: number;
  max: number;
  remaining: number;
  enabled: boolean;
  /** True when Analyze must be disabled. */
  blocked: boolean;
  /** Human explanation when blocked. */
  reason?: string | undefined;
}
export function usageCapStatus(
  sessions: Session[],
  settings: AgentSettings,
  scout: FindingScout,
  now: Date = new Date(),
): UsageCapStatus {
  const { max_analyses_per_day: max, enabled } = settings[scout];
  const used = analysesToday(sessions, now, scout);
  const name = scout === "tracker" ? "Tracker" : "Explorer";
  const reason = !enabled
    ? `${name} is turned off in Settings → Scouts.`
    : used >= max
      ? `${name} reached today's cap of ${max} ${max === 1 ? "analysis" : "analyses"}. Raise it in Settings → Scouts or try again tomorrow.`
      : undefined;
  return {
    scout,
    used,
    max,
    remaining: Math.max(0, max - used),
    enabled,
    blocked: !!reason,
    ...(reason ? { reason } : {}),
  };
}
/** Client-side display threshold. Findings below it stay stored. */
export function splitByConfidence<T extends { confidence: number }>(findings: T[], min: number) {
  return {
    shown: findings.filter((f) => f.confidence >= min),
    hidden: findings.filter((f) => f.confidence < min),
  };
}
