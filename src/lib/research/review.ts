import { isPublicVideo } from "./publicVideo";
import type { Finding, Session } from "./types";
/** Human changes never replace the original structured model output stored on the run. */
export function reviewFinding(
  session: Session,
  id: string,
  changes: Pick<Partial<Finding>, "review_status" | "reviewer_note" | "severity">,
): Session {
  const findings = session.findings.map((f) => {
    if (f.id !== id) return f;
    const updated = { ...f, ...changes };
    if (updated.review_status !== "accepted" && updated.next_step?.status === "approved")
      updated.next_step = {
        ...updated.next_step,
        status: "draft",
        updated_at: new Date().toISOString(),
      };
    // Rejecting or reopening an insight resets an approved test (see testDecisions.ts).
    if (updated.review_status !== "accepted" && updated.test_decision?.decision === "approved") {
      const { decided_at: _decided, ...decision } = updated.test_decision;
      updated.test_decision = { ...decision, decision: "pending" };
    }
    return updated;
  });
  const latest = session.runs
    .filter(
      (r) =>
        r.status === "completed" &&
        r.mode === (isPublicVideo(session) ? "public_video" : "video_frames_plus_events"),
    )
    .at(-1);
  const current = findings.filter((f) => f.analysis_run_id === latest?.id);
  return {
    ...session,
    findings,
    status: latest
      ? current.every((f) => f.review_status !== "pending")
        ? "reviewed"
        : "analyzed"
      : session.status,
  };
}
