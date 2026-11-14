import { reviewFinding } from "./review";
import type { Finding, Session, SuggestedRoute, SuggestedTest, TestDecision } from "./types";

/**
 * Human decisions on a finding's suggested test and route. The model's suggested_test and
 * suggested_route are never mutated; edits live in test_decision.edited_test and the route
 * choice in test_decision.route_override. Approval records intent and (in the UI) starts only a
 * labeled client-side simulated run. No experiment, repository write or deployment happens here.
 */

const pending = (previous?: TestDecision): TestDecision => ({
  decision: "pending",
  edited: previous?.edited ?? false,
  ...(previous?.edited_test ? { edited_test: previous.edited_test } : {}),
  ...(previous?.route_override ? { route_override: previous.route_override } : {}),
});

/** Route in effect: reviewer override, then the model's proposal, then experiment. */
export function effectiveRoute(finding: Pick<Finding, "suggested_route" | "test_decision">) {
  return finding.test_decision?.route_override ?? finding.suggested_route ?? "experiment";
}
/** Test in effect: the reviewer's edited copy when present, otherwise the agent suggestion. */
export function effectiveTest(
  finding: Pick<Finding, "suggested_test" | "test_decision">,
): SuggestedTest | undefined {
  return finding.test_decision?.edited_test ?? finding.suggested_test;
}
/** "Edited by reviewer" vs "Agent suggestion" (or nothing yet). */
export function testSourceLabel(finding: Pick<Finding, "suggested_test" | "test_decision">) {
  if (finding.test_decision?.edited && finding.test_decision.edited_test)
    return "Edited by reviewer";
  return finding.suggested_test ? "Agent suggestion" : null;
}
export const testDecisionOf = (finding: Pick<Finding, "test_decision">) =>
  finding.test_decision?.decision ?? "pending";

const blank = (value: string | undefined) => !value?.trim();
/** Why approval is blocked, or null when the finding's test can be approved. */
export function approvalBlocker(
  finding: Pick<Finding, "review_status" | "suggested_test" | "suggested_route" | "test_decision"> &
    Partial<Pick<Finding, "recommendation">>,
  { assumeAccepted = false } = {},
): string | null {
  const fix = effectiveRoute(finding) === "fix";
  if (!assumeAccepted && finding.review_status !== "accepted")
    return `Accept the insight before approving its ${fix ? "fix" : "test"}.`;
  const test = effectiveTest(finding);
  // A fix may fall back to the insight's recommendation, as the simulated Fixer run does.
  if (fix)
    return blank(test?.change) && blank(finding.recommendation)
      ? "Describe the fix before sending it to the Fixer."
      : null;
  if (!test || blank(test.hypothesis) || blank(test.change) || blank(test.primary_metric))
    return "Add a hypothesis, change and primary metric before approving the test.";
  return null;
}

function patchFinding(
  session: Session,
  findingId: string,
  update: (finding: Finding) => TestDecision,
): Session {
  const finding = session.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error("This finding is no longer available.");
  const decision = update(finding);
  return {
    ...session,
    findings: session.findings.map((f) =>
      f.id === findingId ? { ...f, test_decision: decision } : f,
    ),
  };
}

export function approveTest(session: Session, findingId: string): Session {
  return patchFinding(session, findingId, (finding) => {
    const blocker = approvalBlocker(finding);
    if (blocker) throw new Error(blocker);
    return {
      ...pending(finding.test_decision),
      decision: "approved",
      decided_at: new Date().toISOString(),
    };
  });
}
export function rejectTest(session: Session, findingId: string): Session {
  return patchFinding(session, findingId, (finding) => ({
    ...pending(finding.test_decision),
    decision: "rejected",
    decided_at: new Date().toISOString(),
  }));
}
/** Back to pending, keeping any edited copy and route choice. */
export function resetTest(session: Session, findingId: string): Session {
  return patchFinding(session, findingId, (finding) => pending(finding.test_decision));
}
/** Saves a reviewer copy. Any edit (even after approval or rejection) resets the decision to pending. */
export function editTest(session: Session, findingId: string, test: SuggestedTest): Session {
  const copy: SuggestedTest = {
    hypothesis: String(test.hypothesis ?? "").slice(0, 600),
    change: String(test.change ?? "").slice(0, 600),
    primary_metric: String(test.primary_metric ?? "").slice(0, 120),
    ...(test.guardrail_metric !== undefined
      ? { guardrail_metric: String(test.guardrail_metric).slice(0, 120) }
      : {}),
    ...(test.target_screen !== undefined
      ? { target_screen: String(test.target_screen).slice(0, 200) }
      : {}),
  };
  return patchFinding(session, findingId, (finding) => ({
    ...pending(finding.test_decision),
    edited: true,
    edited_test: copy,
  }));
}
/** Drops the reviewer copy and returns to the agent suggestion (pending). */
export function revertTestEdits(session: Session, findingId: string): Session {
  return patchFinding(session, findingId, (finding) => {
    const { edited_test: _copy, ...rest } = pending(finding.test_decision);
    return { ...rest, edited: false };
  });
}
/** Reviewer route choice. Changing the route after a decision resets it to pending. */
export function setRoute(session: Session, findingId: string, route: SuggestedRoute): Session {
  return patchFinding(session, findingId, (finding) => {
    const current = finding.test_decision;
    const unchanged = effectiveRoute(finding) === route;
    return { ...(unchanged ? (current ?? pending()) : pending(current)), route_override: route };
  });
}
/**
 * One-click "Accept insight & approve test": sets review_status accepted and decision approved
 * in one returned session (one queued write). Throws without changes if the test is not approvable.
 */
export function acceptAndApprove(session: Session, findingId: string): Session {
  const finding = session.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error("This finding is no longer available.");
  const blocker = approvalBlocker(finding, { assumeAccepted: true });
  if (blocker) throw new Error(blocker);
  return approveTest(reviewFinding(session, findingId, { review_status: "accepted" }), findingId);
}
