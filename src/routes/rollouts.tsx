import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/components/research/Shell";
import { Rollouts } from "@/components/research/Rollouts";

/** `?pr=<run id>` opens that simulated PR's review panel. */
export interface RolloutsSearch {
  pr?: string | undefined;
}
const runId = (value: unknown) =>
  typeof value === "string" && /^[\w-]{1,80}$/.test(value) ? value : undefined;

export const Route = createFileRoute("/rollouts")({
  validateSearch: (search: Record<string, unknown>): RolloutsSearch => {
    const pr = runId(search["pr"]);
    return pr ? { pr } : {};
  },
  head: () => pageHead("Rollouts", "Review PRs, check deltas, merge. Simulated demo."),
  component: Rollouts,
});
