import { createFileRoute } from "@tanstack/react-router";
import { Evaluation } from "@/components/research/Evaluation";
import { pageHead } from "@/components/research/Shell";
export const Route = createFileRoute("/evaluation")({
  head: () =>
    pageHead(
      "Evaluation",
      "Evaluate observed issues, detection recall, video necessity, and verified evidence honestly.",
    ),
  component: Evaluation,
});
