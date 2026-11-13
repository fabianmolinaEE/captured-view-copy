import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/components/research/Shell";
import { Home } from "@/components/research/Home";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Home",
      "LoopMate brings recordings, insights, and human judgment into one improvement loop.",
    ),
  component: Home,
});
