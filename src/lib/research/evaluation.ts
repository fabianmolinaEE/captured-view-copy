import { isCompetitorSession } from "./competitors";
import type { Session, AnalysisMode } from "./types";
/** Own-product evaluation only: competitor (Explorer) footage never enters these metrics. */
export function score(sessions: Session[], mode: AnalysisMode = "video_frames_plus_events") {
  let observed = 0,
    detected = 0,
    correct = 0,
    videoEvaluated = 0,
    videoNeeded = 0,
    reviewed = 0,
    unmatched = 0,
    accepted = 0,
    evidence = 0,
    evidenceJudged = 0,
    eligibleSessions = 0,
    unresolved = 0;
  for (const session of sessions) {
    if (isCompetitorSession(session)) continue;
    const run = session.runs.filter((r) => r.status === "completed" && r.mode === mode).at(-1);
    if (!run) continue;
    eligibleSessions++;
    const issues = session.issues.filter((i) => i.actually_observed === "yes");
    observed += issues.length;
    const findings = session.findings.filter((f) => f.analysis_run_id === run.id);
    const matches = findings.flatMap((f) => {
      const match = session.matches.find((m) => m.finding_id === f.id);
      return match ? [match] : [];
    });
    const verified = matches.filter((m) => m.reviewer_verified);
    const valid = verified.filter((m) => issues.some((i) => i.id === m.ground_truth_issue_id));
    // Null is an explicitly verified no-match; a link to an unknown issue is unresolved.
    const falsePositives = verified.filter(
      (m) =>
        m.ground_truth_issue_id === null ||
        session.issues.some(
          (i) => i.id === m.ground_truth_issue_id && i.actually_observed === "no",
        ),
    );
    detected += new Set(valid.map((m) => m.ground_truth_issue_id)).size;
    correct += valid.length;
    reviewed += valid.length + falsePositives.length;
    unmatched += falsePositives.length;
    unresolved += findings.length - valid.length - falsePositives.length;
    if (mode !== "events_only") {
      videoEvaluated += valid.filter((m) => m.video_necessary !== "unknown").length;
      videoNeeded += valid.filter((m) => m.video_necessary === "yes").length;
    }
    accepted += findings.filter((f) => f.review_status === "accepted").length;
    for (const f of findings) {
      const judgment = matches.find((m) => m.finding_id === f.id);
      if (!judgment || !(judgment.evidence_judged || judgment.evidence_verified)) continue;
      evidenceJudged++;
      const validTimestamp =
        Number.isFinite(f.timestamp_ms) &&
        f.timestamp_ms >= 0 &&
        f.timestamp_ms <= session.duration_ms;
      const sources = f.evidence_sources.every((source) =>
        source === "video"
          ? mode !== "events_only" &&
            (session.video_blob.size > 0 ||
              (mode === "public_video" && session.public_video?.duration_verified === true))
          : f.event_ids.length > 0 &&
            f.event_ids.every((id) => session.events.some((e) => e.id === id)),
      );
      if (judgment.evidence_verified && validTimestamp && sources) evidence++;
    }
  }
  return {
    observed,
    detected,
    correct,
    videoEvaluated,
    videoNeeded,
    reviewed,
    unmatched,
    accepted,
    evidence,
    evidenceJudged,
    eligibleSessions,
    unresolved,
  };
}
export function pairedScores(sessions: Session[]) {
  const paired = sessions.filter(
    (s) =>
      !isCompetitorSession(s) &&
      ["events_only", "video_frames_plus_events"].every((mode) =>
        s.runs.some((r) => r.mode === mode && r.status === "completed"),
      ),
  );
  return { sessions: paired.length, video: score(paired), events: score(paired, "events_only") };
}
export const rate = (numerator: number, denominator: number) =>
  denominator ? `${Math.round((numerator / denominator) * 100)}%` : "Insufficient labeled data";
