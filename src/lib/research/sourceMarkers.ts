import { getScout } from "./scouts";
import type { InsightSource, UnifiedInsight } from "./unifiedInsights";

/** Tracker blue / Explorer green, taken from the scout palette so markers match the mascots. */
export const sourceHues = {
  tracker: getScout("tracker").colors.main,
  explorer: getScout("explorer").colors.main,
} as const;

/** Colors for a source: one hue for Tracker or Explorer, both hues for "both". */
export function sourceColorList(source: InsightSource): string[] {
  if (source === "both") return [sourceHues.tracker, sourceHues.explorer];
  return [sourceHues[source]];
}

/** CSS background for a source accent bar (solid, or a blue→green split for "both"). */
export function sourceAccent(source: InsightSource) {
  return source === "both"
    ? `linear-gradient(180deg, ${sourceHues.tracker} 0 50%, ${sourceHues.explorer} 50% 100%)`
    : sourceHues[source];
}

/** Compact one-badge decision state for a card. */
export function decisionState(item: Pick<UnifiedInsight, "review_status" | "decision" | "route">) {
  const noun = item.route === "fix" ? "Fix" : "Test";
  if (item.review_status === "rejected") return { text: "Rejected", tone: "muted" as const };
  if (item.decision === "approved") return { text: `${noun} approved`, tone: "done" as const };
  if (item.decision === "rejected") return { text: `${noun} rejected`, tone: "muted" as const };
  if (item.review_status === "pending") return { text: "Needs review", tone: "attention" as const };
  return { text: `${noun} awaiting decision`, tone: "attention" as const };
}
