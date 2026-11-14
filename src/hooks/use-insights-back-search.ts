import { useSearch } from "@tanstack/react-router";

/** Search for an insight detail's back link: keeps the Insights source filter the user came from. */
export function useInsightsBackSearch(): { source?: "tracker" | "explorer" | "both" } {
  const search = useSearch({ strict: false }) as { source?: unknown };
  const source = search.source;
  return source === "tracker" || source === "explorer" || source === "both" ? { source } : {};
}
