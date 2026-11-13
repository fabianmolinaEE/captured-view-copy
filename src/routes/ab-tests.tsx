import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/components/research/Shell";
import { ComingSoon } from "@/components/research/ComingSoon";
export const Route = createFileRoute("/ab-tests")({
  head: () => pageHead("A/B Tests", "Human-approved experiments are coming to LoopMate."),
  component: () => <ComingSoon area="experiments" />,
});
