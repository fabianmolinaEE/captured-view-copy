import { createFileRoute } from "@tanstack/react-router";
import { Insights } from "@/components/research/Insights";
import { pageHead } from "@/components/research/Shell";
export const Route = createFileRoute("/insights/")({
  head: () =>
    pageHead("Insights", "Review real findings and prioritize evidence-backed opportunities."),
  component: Insights,
});
