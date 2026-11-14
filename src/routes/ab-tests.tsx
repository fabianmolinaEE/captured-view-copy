import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/components/research/Shell";
import { ABTests } from "@/components/research/ABTests";

/** `?run=<id>` deep-links a simulated experiment run (e.g. right after approving its test). */
export interface ABTestsSearch {
  run?: string | undefined;
}
const runId = (value: unknown) =>
  typeof value === "string" && /^[\w-]{1,80}$/.test(value) ? value : undefined;

export const Route = createFileRoute("/ab-tests")({
  validateSearch: (search: Record<string, unknown>): ABTestsSearch => {
    const run = runId(search["run"]);
    return run ? { run } : {};
  },
  head: () => pageHead("A/B Tests", "Approved tests run here. Simulated demo."),
  component: ABTests,
});
