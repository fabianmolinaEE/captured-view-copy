import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/components/research/Shell";
import { HeroHQ } from "@/components/research/HeroHQ";
export const Route = createFileRoute("/hq")({
  head: () =>
    pageHead(
      "HQ",
      "Agent activity, usage and the insights that need you. Simulated parts are labeled.",
    ),
  component: HeroHQ,
});
