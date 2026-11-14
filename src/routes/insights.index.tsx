import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Insights } from "@/components/research/Insights";
import { pageHead } from "@/components/research/Shell";
import { sourceFilterFromTab } from "@/lib/research/unifiedInsights";
export const Route = createFileRoute("/insights/")({
  head: () => pageHead("Insights", "What your users and competitors show you."),
  component: InsightsPage,
});
function InsightsPage() {
  const { tab, source } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <Insights
      source={source ?? sourceFilterFromTab(tab)}
      onSourceChange={(next) =>
        void navigate({
          to: "/insights",
          search: next === "all" ? {} : { source: next },
          replace: true,
        })
      }
    />
  );
}
