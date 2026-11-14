import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * `?source=` filters the unified Insights list. The legacy `?tab=competitors` (the former
 * standalone Competitors tab) still loads and maps to the Explorer filter.
 */
export interface InsightsSearch {
  tab?: "competitors" | undefined;
  source?: "tracker" | "explorer" | "both" | undefined;
}
const sources = new Set(["tracker", "explorer", "both"]);
export const Route = createFileRoute("/insights")({
  validateSearch: (search: Record<string, unknown>): InsightsSearch => ({
    ...(search["tab"] === "competitors" ? { tab: "competitors" as const } : {}),
    ...(typeof search["source"] === "string" && sources.has(search["source"])
      ? { source: search["source"] as InsightsSearch["source"] }
      : {}),
  }),
  component: Outlet,
});
