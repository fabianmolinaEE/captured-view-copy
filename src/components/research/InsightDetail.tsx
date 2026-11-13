import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { ArrowLeft, Check, X, Film, Download, Clock3 } from "lucide-react";
import { Shell } from "./Shell";
import { Button } from "@/components/ui/button";
import { useResearchSession } from "@/hooks/use-research-session";
import { reviewFinding } from "@/lib/research/review";
import { exportSession } from "@/lib/research/sessionStorage";
import { label, duration } from "@/lib/research/types";
import { EvidencePanel } from "./EvidencePanel";
import { NextStepDraft } from "./NextStepDraft";

/** Render model text as safe Markdown, excluding HTML, remote images and link side effects. */
function Narrative({ text }: { text: string }) {
  return (
    <Markdown
      skipHtml
      unwrapDisallowed
      allowedElements={[
        "p",
        "strong",
        "em",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "blockquote",
        "code",
        "pre",
        "br",
        "hr",
      ]}
    >
      {text}
    </Markdown>
  );
}
export function InsightDetail({ sessionId, findingId }: { sessionId: string; findingId: string }) {
  const { session, loading, error, unsaved, update, retry } = useResearchSession(sessionId);
  const finding = session?.findings.find((f) => f.id === findingId);
  const run = session?.runs.find((r) => r.id === finding?.analysis_run_id);
  if (loading)
    return (
      <Shell section="Insight review">
        <div className="empty-sessions">
          <p>Opening the finding and its evidence…</p>
        </div>
      </Shell>
    );
  if (!session || !finding || !run || run.status !== "completed")
    return (
      <Shell section="Insight review">
        <div className="empty-sessions">
          <h2>Insight unavailable</h2>
          <p>
            {error ||
              "This finding is not available in this browser. It may have been deleted or belong to a shared recording you have not imported."}
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/insights">Back to insights</Link>
          </Button>
        </div>
      </Shell>
    );
  return (
    <Shell section="Insight review">
      <Link className="back-link" to="/insights">
        <ArrowLeft size={14} />
        All insights
      </Link>
      <div className="insight-detail-top">
        <div>
          <div className="insight-row-labels">
            <span>{label(finding.category)}</span>
            <span>Internal · Saved real analysis</span>
          </div>
          <h1>{finding.title}</h1>
          <p>
            <Film size={13} />
            {session.title}
            <span>·</span>
            <Clock3 size={13} />
            {duration(finding.timestamp_ms)}
          </p>
        </div>
        <span className={`status-badge ${finding.review_status === "accepted" ? "reviewed" : ""}`}>
          {finding.review_status === "pending" ? "Needs review" : label(finding.review_status)}
        </span>
      </div>
      {error && (
        <div className="error-note mb-4" role="alert">
          {error}
        </div>
      )}
      <div className="save-state" role="status">
        {unsaved ? "Saving or unsaved local edits" : "Saved in this browser"}
        {unsaved && (
          <Button size="sm" variant="outline" onClick={() => void retry()}>
            Retry save
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => exportSession(session)}>
          <Download size={13} />
          Export research
        </Button>
      </div>
      <div className="insight-detail-layout">
        <article className="insight-narrative">
          <section className="narrative-section">
            <span className="section-kicker">The finding</span>
            <div className="model-markdown">
              <Narrative text={finding.description} />
            </div>
          </section>
          <section className="narrative-section">
            <h2>What was observed</h2>
            <div className="model-markdown">
              <Narrative
                text={
                  finding.observed_evidence ??
                  finding.visual_evidence ??
                  "No separate observation was provided."
                }
              />
            </div>
          </section>
          <section className="narrative-section">
            <h2>What it could mean</h2>
            <div className="model-markdown">
              <Narrative
                text={
                  finding.interpretation ??
                  "This older analysis did not separate interpretation from observation. Verify the original explanation against the evidence."
                }
              />
            </div>
            {finding.why_video_matters && (
              <div className="video-contribution">
                <strong>What video adds</strong>
                <p>{finding.why_video_matters}</p>
              </div>
            )}
          </section>
          <div className="model-provenance">
            <strong>Saved real analysis</strong>
            <p>
              {run.model_name} · {run.mode === "events_only" ? "Events only" : "Video + events"} ·{" "}
              {new Date(run.completed_at).toLocaleString()}
            </p>
            <p>
              Model confidence {Math.round(finding.confidence * 100)}% (uncalibrated) ·{" "}
              {run.frame_count ?? "Unknown"} frames · {run.latency_ms ?? "Unknown"} ms
            </p>
            <p>
              Reported tokens: {run.usage?.total_tokens ?? "not available"} · Cost: unavailable.
              {run.raw_output !== undefined
                ? "Original model output is preserved with this run."
                : "Original structured output is unavailable for this older run."}
            </p>
          </div>
          <section className="human-review-panel">
            <span className="section-kicker">Your judgment</span>
            <h2>Does the evidence support this finding?</h2>
            <p>Model proposals become accepted findings only after your review.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                size="sm"
                variant={finding.review_status === "accepted" ? "default" : "outline"}
                onClick={() =>
                  void update((s) => reviewFinding(s, finding.id, { review_status: "accepted" }))
                }
              >
                <Check size={14} />
                Accept finding
              </Button>
              <Button
                size="sm"
                variant={finding.review_status === "rejected" ? "destructive" : "outline"}
                onClick={() =>
                  void update((s) => reviewFinding(s, finding.id, { review_status: "rejected" }))
                }
              >
                <X size={14} />
                Reject finding
              </Button>
              {finding.review_status !== "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void update((s) => reviewFinding(s, finding.id, { review_status: "pending" }))
                  }
                >
                  Reopen review
                </Button>
              )}
            </div>
            <label className="field">
              Researcher severity estimate
              <select
                value={finding.severity ?? "major"}
                onChange={(e) =>
                  void update((s) =>
                    reviewFinding(s, finding.id, {
                      severity: e.target.value as "minor" | "major" | "blocker",
                    }),
                  )
                }
              >
                <option value="minor">Minor friction</option>
                <option value="major">Major friction (default estimate)</option>
                <option value="blocker">Observed task blocker</option>
              </select>
            </label>
            <label className="field">
              Researcher note
              <textarea
                rows={3}
                value={finding.reviewer_note ?? ""}
                placeholder="Add your context, disagreement, or interpretation."
                onChange={(e) =>
                  void update((s) =>
                    reviewFinding(s, finding.id, { reviewer_note: e.target.value }),
                  )
                }
              />
            </label>
          </section>
          <NextStepDraft finding={finding} update={update} />
        </article>
        <EvidencePanel key={finding.id} session={session} finding={finding} />
      </div>
    </Shell>
  );
}
