import { createFileRoute } from "@tanstack/react-router";
import { TestApp } from "@/components/research/TestApp";
import { pageHead } from "@/components/research/Shell";
export const Route = createFileRoute("/test-app")({
  head: () =>
    pageHead(
      "Test App",
      "Record a controlled mobile-shaped checkout with first-party synchronized interaction evidence.",
    ),
  component: TestApp,
});
