import { createFileRoute } from "@tanstack/react-router";
import { TestApp } from "@/components/research/TestApp";
import { pageHead } from "@/components/research/Shell";
export const Route = createFileRoute("/test-app")({
  head: () =>
    pageHead(
      "Test App",
      "Record the Bag Checkout App or add Uber Eats recordings with synchronized evidence.",
    ),
  component: TestApp,
});
