import { useProduct } from "@/hooks/use-product";
import { sessionsForProduct } from "@/lib/research/products";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Target,
  Video,
  CircleAlert,
  ShieldCheck,
  ArrowUpRight,
  FlaskConical,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, PageHeading, Footer } from "./Shell";
import { listSessions, saveSession } from "@/lib/research/sessionStorage";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { curatedCopyToSave } from "@/lib/research/demo/importTrackerRuns";
import { type Session, type FindingMatch, type AnalysisMode, label } from "@/lib/research/types";
import { score, rate, pairedScores } from "@/lib/research/evaluation";
export function Evaluation() {
  const [mode, setMode] = useState<AnalysisMode>("video_frames_plus_events");
  const { productId, product } = useProduct();
  const [allSessions, setSessions] = useState<Session[]>([]);
  const sessions = sessionsForProduct(allSessions, productId);
  const [error, setError] = useState("");
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, []);
  useSessionsChanged(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  });
  const queue = useRef(Promise.resolve());
  const persist = async (s: Session) => {
    try {
      const next = s.sync ? { ...s, sync: { ...s.sync, state: "local_changes" as const } } : s;
      setSessions((prev) => prev.map((v) => (v.id === s.id ? next : v)));
      // A stale pre-generated copy must not revive what the curation migration removed.
      const pending = queue.current
        .catch(() => {})
        .then(async () => saveSession(await curatedCopyToSave(next)));
      queue.current = pending.then(
        () => {},
        () => {},
      );
      await pending;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    }
  };
  const activeMode = productId === "uber-eats" ? "public_video" : mode;
  const metrics = score(sessions, activeMode);
  const paired = pairedScores(sessions);
  const stats = [
    {
      title: "Detection rate",
      value: metrics.unresolved
        ? "Insufficient labeled data"
        : rate(metrics.detected, metrics.observed),
      sub: `${metrics.detected} / ${metrics.observed} observed issues`,
      icon: Target,
    },
    {
      title: "Video-needed rate",
      value: rate(metrics.videoNeeded, metrics.videoEvaluated),
      sub: `${metrics.videoNeeded} / ${metrics.videoEvaluated} human-evaluated findings`,
      icon: Video,
    },
    {
      title: "False-positive share",
      value: rate(metrics.unmatched, metrics.reviewed),
      sub: `${metrics.unmatched} / ${metrics.reviewed} correctness-reviewed proposals`,
      icon: CircleAlert,
    },
    {
      title: "Evidence quality",
      value: rate(metrics.evidence, metrics.evidenceJudged),
      sub: `${metrics.evidence} / ${metrics.evidenceJudged} evidence-judged proposals`,
      icon: ShieldCheck,
    },
  ];
  return (
    <Shell section="Evaluation">
      <PageHeading
        title="Evaluation"
        description={`${product?.name ?? "Product"} · Does video catch what events miss?`}
        action={
          <Button asChild variant="outline">
            <Link to="/test-app">
              Record a session
              <ArrowUpRight />
            </Link>
          </Button>
        }
      />
      <label className="field">
        Evaluation mode
        <select value={activeMode} onChange={(e) => setMode(e.target.value as AnalysisMode)}>
          {productId === "uber-eats" ? (
            <option value="public_video">Video recordings</option>
          ) : (
            <>
              <option value="video_frames_plus_events">Video + events</option>
              <option value="events_only">Events-only baseline</option>
            </>
          )}
        </select>
      </label>
      <p className="text-xs mb-4">
        {metrics.eligibleSessions} analyzed sessions · {metrics.unresolved} unresolved · Detection
        waits until all are resolved.
      </p>
      {productId === "uber-eats" ? (
        <div className="info-note mb-5">
          No interaction events on these recordings, so there is no events-only comparison.
        </div>
      ) : (
        <section className="finding">
          <h3>Paired comparison · {paired.sessions} identical sessions</h3>
          <p>Latest run per mode, same human rubric. No improvement claimed.</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Verified detection</th>
                  <th>False-positive share</th>
                  <th>Verified evidence</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Video + events", paired.video],
                  ["Events only", paired.events],
                ].map(([name, raw]) => {
                  const m = raw as ReturnType<typeof score>;
                  return (
                    <tr key={String(name)}>
                      <td>{String(name)}</td>
                      <td>
                        {m.unresolved ? "Insufficient labeled data" : rate(m.detected, m.observed)}{" "}
                        ({m.detected}/{m.observed})
                      </td>
                      <td>
                        {rate(m.unmatched, m.reviewed)} ({m.unmatched}/{m.reviewed})
                      </td>
                      <td>
                        {rate(m.evidence, m.evidenceJudged)} ({m.evidence}/{m.evidenceJudged})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.title}>
            <div className="stat-title">
              {s.title}
              <s.icon />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="info-note mb-7">
        <Info />
        <span title="Duplicate proposals cannot raise recall. Whether video was needed is a human judgment, not a model claim.">
          Only observed issues and human-verified matches count. Zero eligible evidence means N/A.
        </span>
      </div>
      <div className="research-band border-t">
        <div className="research-symbol">
          <FlaskConical size={20} />
        </div>
        <div>
          <h3>Build an honest research set</h3>
          <p>Small samples are directional, not proof.</p>
        </div>
        <div className="research-progress">
          <span>{sessions.length} recordings</span>
        </div>
      </div>
      {error && <div className="error-note">{error}</div>}
      {!sessions.length ? (
        <div className="empty-sessions border-t mb-7">
          <Target size={31} className="text-primary mb-5" />
          <h2>No evidence to evaluate. Yet.</h2>
          <p>Record a session, label what you saw, then match the AI proposals.</p>
          <Button asChild className="mt-6">
            <Link to="/test-app">
              Record a test session
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      ) : (
        sessions.map((s) => {
          const per = score([s], activeMode);
          const run = s.runs
            .filter((r) => r.status === "completed" && r.mode === activeMode)
            .at(-1);
          const findings = run ? s.findings.filter((f) => f.analysis_run_id === run.id) : [];
          return (
            <section key={s.id} className="eval-session">
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">{s.title}</h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    Recall {rate(per.detected, per.observed)} · {per.detected}/{per.observed}{" "}
                    observed issues detected
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/sessions/$id" params={{ id: s.id }}>
                    Review evidence
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
              {s.issues.map((issue) => (
                <div className="issue-row" key={issue.id}>
                  <span className="capitalize">
                    {label(issue.category)}
                    <small className="block text-muted-foreground mt-1">
                      {label(issue.screen)}
                    </small>
                  </span>
                  <select
                    className="select-control"
                    aria-label={`Observed ${issue.category} in ${s.title}`}
                    value={issue.actually_observed}
                    onChange={(e) =>
                      void persist({
                        ...s,
                        issues: s.issues.map((i) =>
                          i.id === issue.id
                            ? {
                                ...i,
                                actually_observed: e.target.value as "yes" | "no" | "unknown",
                              }
                            : i,
                        ),
                      })
                    }
                  >
                    <option value="unknown">Not checked</option>
                    <option value="yes">Observed</option>
                    <option value="no">Not observed</option>
                  </select>
                </div>
              ))}
              {findings.map((f) => {
                const match =
                  s.matches.find((m) => m.finding_id === f.id) ??
                  ({
                    finding_id: f.id,
                    ground_truth_issue_id: null,
                    reviewer_verified: false,
                    video_necessary: "unknown",
                    evidence_verified: false,
                  } as FindingMatch);
                const update = (patch: Partial<FindingMatch>) =>
                  void persist({
                    ...s,
                    matches: [
                      ...s.matches.filter((m) => m.finding_id !== f.id),
                      { ...match, ...patch },
                    ],
                  });
                return (
                  <div className="finding" key={f.id}>
                    <h3>{f.title}</h3>
                    <label>Match to one observed issue</label>
                    <select
                      className="select-control w-full"
                      value={match.ground_truth_issue_id ?? ""}
                      onChange={(e) => update({ ground_truth_issue_id: e.target.value || null })}
                    >
                      <option value="">Unmatched proposal</option>
                      {s.issues
                        .filter((i) => i.actually_observed === "yes")
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {label(i.category)}
                          </option>
                        ))}
                    </select>
                    <label className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        checked={match.reviewer_verified}
                        onChange={(e) => update({ reviewer_verified: e.target.checked })}
                      />
                      I verified this correctness decision
                    </label>
                    <label>Did this finding require video evidence?</label>
                    <select
                      className="select-control w-full"
                      value={match.video_necessary}
                      onChange={(e) =>
                        update({ video_necessary: e.target.value as "yes" | "no" | "unknown" })
                      }
                    >
                      <option value="unknown">Not evaluated</option>
                      <option value="yes">Yes — video necessary</option>
                      <option value="no">No — events were sufficient</option>
                    </select>
                    <label>Evidence quality judgment</label>
                    <select
                      className="select-control w-full"
                      value={
                        match.evidence_judged || match.evidence_verified
                          ? match.evidence_verified
                            ? "supported"
                            : "unsupported"
                          : "unknown"
                      }
                      onChange={(e) =>
                        update({
                          evidence_judged: e.target.value !== "unknown",
                          evidence_verified: e.target.value === "supported",
                        })
                      }
                    >
                      <option value="unknown">Not checked — exclude</option>
                      <option value="supported">
                        Timestamp and cited context support the finding
                      </option>
                      <option value="unsupported">
                        Checked — evidence does not support the finding
                      </option>
                    </select>
                  </div>
                );
              })}
              {!findings.length && (
                <p className="text-xs text-muted-foreground mt-4">
                  No AI proposals to match. Your labels are still saved.
                </p>
              )}
            </section>
          );
        })
      )}
      <Footer />
    </Shell>
  );
}
