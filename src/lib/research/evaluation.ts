import type { Session } from './types';
export function score(sessions: Session[]) {
  let observed = 0, detected = 0, correct = 0, videoEvaluated = 0, videoNeeded = 0, reviewed = 0, unmatched = 0, accepted = 0, evidence = 0;
  for (const session of sessions) {
    const issues = session.issues.filter(i => i.actually_observed === 'yes');
    observed += issues.length;
    const latestRun = session.runs.filter(r => r.status === 'completed' && r.mode === 'video_frames_plus_events').at(-1);
    const findings = latestRun ? session.findings.filter(f => f.analysis_run_id === latestRun.id) : [];
    const ids = new Set(findings.map(f => f.id));
    const matches = session.matches.filter(m => m.reviewer_verified && ids.has(m.finding_id));
    const valid = matches.filter(m => issues.some(i => i.id === m.ground_truth_issue_id));
    detected += new Set(valid.map(m => m.ground_truth_issue_id)).size;
    correct += valid.length;
    reviewed += matches.length; unmatched += matches.length - valid.length;
    videoEvaluated += valid.filter(m => m.video_necessary !== 'unknown').length;
    videoNeeded += valid.filter(m => m.video_necessary === 'yes').length;
    for (const f of findings.filter(f => f.review_status === 'accepted')) {
      accepted++;
      if (session.video_blob.size > 0 && f.timestamp_ms >= 0 && f.timestamp_ms <= session.duration_ms && f.event_ids.some(id => session.events.some(e => e.id === id)) && matches.some(m => m.finding_id === f.id && m.evidence_verified)) evidence++;
    }
  }
  return { observed, detected, correct, videoEvaluated, videoNeeded, reviewed, unmatched, accepted, evidence };
}
export const rate = (numerator: number, denominator: number) => denominator ? `${Math.round(numerator / denominator * 100)}%` : 'N/A';
