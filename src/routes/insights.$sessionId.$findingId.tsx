import { createFileRoute } from "@tanstack/react-router";
import { InsightDetail } from "@/components/research/InsightDetail";
import { pageHead } from "@/components/research/Shell";
export const Route = createFileRoute("/insights/$sessionId/$findingId")({
  head: () =>
    pageHead(
      "Insight review",
      "Inspect the recording, review a finding, and save your next-step draft.",
    ),
  component: Detail,
});
function Detail() {
  const { sessionId, findingId } = Route.useParams();
  return <InsightDetail sessionId={sessionId} findingId={findingId} />;
}
