import type { Finding, Session } from "./types";
export function latestFindings(
  session: Session,
  mode: "events_only" | "video_frames_plus_events" = "video_frames_plus_events",
) {
  const run = session.runs.filter((r) => r.status === "completed" && r.mode === mode).at(-1);
  return run ? session.findings.filter((f) => f.analysis_run_id === run.id) : [];
}
export interface Insight {
  key: string;
  title: string;
  category: Finding["category"];
  screen: string;
  affected: number;
  eligible: number;
  percentage: number;
  priority: number;
  severity: "minor" | "major" | "blocker";
  quality: number;
  retryRate: number;
  evidence: { session: Session; finding: Finding }[];
}
/** Controlled-app equivalence is category + screen. Scores are triage heuristics, never causal impact. */
export function aggregateInsights(sessions: Session[]): Insight[] {
  const eligible = sessions.filter(
    (s) =>
      s.runs.some((r) => r.status === "completed" && r.mode === "video_frames_plus_events") &&
      latestFindings(s).every((f) => f.review_status !== "pending"),
  );
  const groups = new Map<string, Insight>();
  for (const session of eligible)
    for (const finding of latestFindings(session).filter((f) => f.review_status === "accepted")) {
      const screen = (finding.screen ?? "unspecified").trim().toLowerCase().replaceAll(/\s+/g, "_");
      const key = `${finding.category}:${screen}`;
      const insight = groups.get(key) ?? {
        key,
        title: finding.title,
        category: finding.category,
        screen,
        affected: 0,
        eligible: eligible.length,
        percentage: 0,
        priority: 0,
        severity: "minor",
        quality: 0,
        retryRate: 0,
        evidence: [],
      };
      insight.evidence.push({ session, finding });
      groups.set(key, insight);
    }
  return [...groups.values()]
    .map((group) => {
      const ids = [...new Set(group.evidence.map((e) => e.session.id))];
      group.affected = ids.length;
      group.percentage = (group.affected / group.eligible) * 100;
      const severityValue = { minor: 0.2, major: 0.6, blocker: 1 };
      const perSession = ids.map((id) => {
        const entries = group.evidence.filter((e) => e.session.id === id);
        return {
          severity: Math.max(...entries.map((e) => severityValue[e.finding.severity ?? "major"])),
          quality: Math.max(
            ...entries.map(({ session, finding }) => {
              const timestamp =
                Number.isFinite(finding.timestamp_ms) &&
                finding.timestamp_ms >= 0 &&
                finding.timestamp_ms <= session.duration_ms;
              const linked = finding.event_ids.some((id) =>
                session.events.some((e) => e.id === id),
              );
              const human = session.matches.some(
                (m) => m.finding_id === finding.id && m.evidence_verified,
              );
              return (
                (timestamp ? 0.3 : 0) +
                (linked ? 0.2 : 0) +
                (human ? 0.4 : 0) +
                Math.max(0, Math.min(1, finding.confidence)) * 0.1
              );
            }),
          ),
          retry: entries.some(
            ({ session, finding }) =>
              session.events.filter(
                (e) => e.type === "retry" && Math.abs(e.t_ms - finding.timestamp_ms) <= 10000,
              ).length >= 2,
          )
            ? 1
            : 0,
        };
      });
      const blocker = group.evidence.some((e) => e.finding.severity === "blocker");
      group.severity = blocker
        ? "blocker"
        : group.evidence.some((e) => (e.finding.severity ?? "major") === "major")
          ? "major"
          : "minor";
      group.quality = perSession.reduce((n, v) => n + v.quality, 0) / ids.length;
      group.retryRate = perSession.reduce((n, v) => n + v.retry, 0) / ids.length;
      const severity = perSession.reduce((n, v) => n + v.severity, 0) / ids.length;
      group.priority = Math.round(
        Math.max(
          blocker ? 85 : 0,
          (40 * group.affected) / group.eligible +
            35 * severity +
            15 * group.retryRate +
            10 * group.quality,
        ),
      );
      return group;
    })
    .sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
}
