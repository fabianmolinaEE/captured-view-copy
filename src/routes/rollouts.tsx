import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/components/research/Shell";
import { ComingSoon } from "@/components/research/ComingSoon";
export const Route = createFileRoute("/rollouts")({
  head: () =>
    pageHead("Rollouts", "Reviewed releases and measured outcomes are coming to LoopMate."),
  component: () => <ComingSoon area="rollouts" />,
});
