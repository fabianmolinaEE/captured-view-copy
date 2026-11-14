import { createFileRoute } from "@tanstack/react-router";
import { InsightDetail } from "@/components/research/InsightDetail";
import { pageHead } from "@/components/research/Shell";
export const Route = createFileRoute("/insights/$sessionId/$findingId")({
  /** `?t=<ms>` opens the evidence video at a highlight timestamp. */
  validateSearch: (search: Record<string, unknown>): { t?: number | undefined } => {
    const t = Number(search["t"]);
    return search["t"] !== undefined && Number.isFinite(t) && t >= 0 ? { t: Math.round(t) } : {};
  },
  head: () => pageHead("Insight", "Watch the evidence and decide on the suggested test."),
  component: Detail,
});
/** `/insights/sample/order-again` is the labeled fictional sample; InsightDetail routes it. */
function Detail() {
  const { sessionId, findingId } = Route.useParams();
  const { t } = Route.useSearch();
  return <InsightDetail sessionId={sessionId} findingId={findingId} seekMs={t} />;
}
