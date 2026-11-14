import { useEffect } from "react";
import { evidenceProductOf, useProduct } from "@/hooks/use-product";
import { productNameForSource, products, type ProductId } from "@/lib/research/products";
import { competitorOf, isCompetitorSession } from "@/lib/research/competitors";
import { candidateNote } from "@/lib/research/publicVideo";
import { pregeneratedRunLabel } from "@/lib/research/demo/importExplorerRuns";
import { discardRunsForFinding } from "@/lib/research/simulation";
import { testDecisionOf } from "@/lib/research/testDecisions";
import { Link } from "@tanstack/react-router";
import { useInsightsBackSearch } from "@/hooks/use-insights-back-search";
import Markdown from "react-markdown";
import { ArrowLeft, Check, X, Film, Download, Clock3 } from "lucide-react";
import { Shell } from "./Shell";
import { Button } from "@/components/ui/button";
import { useResearchSession } from "@/hooks/use-research-session";
import { reviewFinding } from "@/lib/research/review";
import { exportSession } from "@/lib/research/sessionStorage";
import { label, duration, type Session } from "@/lib/research/types";
import { EvidencePanel } from "./EvidencePanel";
import { NextStepDraft } from "./NextStepDraft";
import { SuggestedTestPanel } from "./SuggestedTestPanel";
import { SourceMarker, VideoCount } from "./SourceMarker";
import { SampleInsightDetail } from "./SampleInsightDetail";
import { getSampleInsight } from "@/lib/research/demo/happyPath";

/** The product a session belongs to: its own product, or the product a competitor video informs. */
function owningProduct(session: Session | undefined): ProductId | null {
  return evidenceProductOf(session) ?? null;
}
/** An evidence deep link adopts its product (including a competitor's product) before rendering. */
function useOwningProduct(session: Session | undefined) {
  const { productId, selectProduct } = useProduct();
  const target = owningProduct(session);
  const sessionId = session?.id;
  useEffect(() => {
    if (target) selectProduct(target);
  }, [target, sessionId, selectProduct]);
  return { target, matches: !!target && target === productId };
}

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
interface DetailProps {
  sessionId: string;
  findingId: string;
  /** Evidence timestamp to open the video at (from a highlight chip). */
  seekMs?: number | undefined;
}
/**
 * Insight detail. `/insights/sample/order-again` is the labeled fictional sample, which has no
 * stored session and opens SampleInsightDetail; everything else is a real stored finding.
 */
export function InsightDetail(props: DetailProps) {
  const sample = getSampleInsight(props.sessionId, props.findingId);
  if (sample) return <SampleInsightDetail sample={sample} />;
  return <RealInsightDetail {...props} />;
}
function RealInsightDetail({ sessionId, findingId, seekMs }: DetailProps) {
  const { session, loading, error, unsaved, update, retry } = useResearchSession(sessionId);
  const { target, matches: productMatches } = useOwningProduct(session);
  const backSearch = useInsightsBackSearch();
  const finding = session?.findings.find((f) => f.id === findingId);
  const run = session?.runs.find((r) => r.id === finding?.analysis_run_id);
  if (session && !target)
    return (
      <Shell section="Insight review">
        <div className="empty-sessions">
          <h2>Product unavailable</h2>
          <p>This recording's product isn't in this workspace.</p>
          <Button variant="outline" onClick={() => exportSession(session)}>
            Export recording data
          </Button>
        </div>
      </Shell>
    );
  if (loading || (session && !productMatches))
    return (
      <Shell section="Insight review">
        <div className="empty-sessions">
          <p>Opening the insight…</p>
        </div>
      </Shell>
    );
  if (!session || !finding || !run || run.status !== "completed")
    return (
      <Shell section="Insight review">
        <div className="empty-sessions">
          <h2>Insight unavailable</h2>
          <p>{error || "It may have been deleted, or it isn't in this browser yet."}</p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/insights" search={backSearch}>
              Back to insights
            </Link>
          </Button>
        </div>
      </Shell>
    );
  const competitor = isCompetitorSession(session);
  /** Competitor footage informs this product (Explorer framing: "What Uber Eats could adopt"). */
  const productName = products.find((p) => p.id === target)?.name ?? "your product";
  const competitorName = competitorOf(target)?.name;
  /** Insight review change; withdrawing an approved test also withdraws its simulated runs. */
  const review = (status: "accepted" | "rejected" | "pending") => {
    const wasApproved = testDecisionOf(finding) === "approved";
    void update((s) => reviewFinding(s, finding.id, { review_status: status })).then(() => {
      if (wasApproved && status !== "accepted") discardRunsForFinding(finding.id);
    });
  };
  return (
    <Shell section="Insight review">
      <Link className="back-link" to="/insights" search={backSearch}>
        <ArrowLeft size={14} />
        Insights
      </Link>
      <div className="insight-detail-top">
        <div>
          <div className="insight-row-labels items-center">
            <span>{label(finding.category)}</span>
            <SourceMarker
              source={competitor ? "explorer" : "tracker"}
              competitor={competitor ? (competitorName ?? session.source_app) : null}
            />
            <VideoCount count={1} source={competitor ? "explorer" : "tracker"} />
            {competitor && <span>Competitor pattern</span>}
          </div>
          <h1>{finding.title}</h1>
          <p>
            <Film size={13} />
            {competitor ? session.source_app : productNameForSource(session.source_app)} ·{" "}
            {session.title}
            {candidateNote(session.public_video?.video_id) && (
              <> · {candidateNote(session.public_video?.video_id)}</>
            )}
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
            <span className="section-kicker">
              {competitor ? `What ${session.source_app} does` : "Insight"}
            </span>
            <div className="model-markdown">
              <Narrative text={finding.description} />
            </div>
          </section>
          <details className="narrative-section">
            <summary className="cursor-pointer">
              <h2 className="inline">Observed &amp; what it means</h2>
            </summary>
            <div className="model-markdown mt-2">
              <Narrative
                text={
                  finding.observed_evidence ??
                  finding.visual_evidence ??
                  "No separate observation was provided."
                }
              />
            </div>
            {finding.interpretation && (
              <div className="model-markdown mt-2">
                <Narrative text={finding.interpretation} />
              </div>
            )}
            {finding.why_video_matters && (
              <div className="video-contribution">
                <strong>What video adds</strong>
                <p>{finding.why_video_matters}</p>
              </div>
            )}
          </details>
          {finding.recommendation && (
            <section className="narrative-section">
              <h2>{competitor ? `What ${productName} could adopt` : "Suggested improvement"}</h2>
              <div className="model-markdown">
                <Narrative text={finding.recommendation} />
              </div>
              {finding.expected_benefit && <p>{finding.expected_benefit}</p>}
            </section>
          )}
          <details className="model-provenance">
            <summary className="cursor-pointer">
              <strong>Analysis details</strong>
            </summary>
            {session.pregenerated?.run_ids.includes(run.id) && (
              <p>{pregeneratedRunLabel(session)} · not counted toward today's cap</p>
            )}
            <p>
              {run.model_name} ·{" "}
              {run.mode === "public_video"
                ? "Video recording"
                : run.mode === "events_only"
                  ? "Events only"
                  : "Video + events"}{" "}
              · {new Date(run.completed_at).toLocaleString()}
            </p>
            <p>
              Model confidence {Math.round(finding.confidence * 100)}% (uncalibrated) ·{" "}
              {run.mode === "public_video"
                ? "Direct video input"
                : `${run.frame_count ?? "Unknown"} frames`}{" "}
              · {run.latency_ms ?? "Unknown"} ms
            </p>
            <p>
              Tokens: {run.usage?.total_tokens ?? "not reported"} ·{" "}
              {run.raw_output !== undefined
                ? "Original output kept"
                : "Original output unavailable"}
            </p>
          </details>
          <section className="human-review-panel">
            <span className="section-kicker">Your call</span>
            <h2>Does the evidence hold up?</h2>
            {competitor && <p>Inspiration only · not in {productName}'s metrics</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                size="sm"
                variant={finding.review_status === "accepted" ? "default" : "outline"}
                onClick={() => review("accepted")}
              >
                <Check size={14} />
                Accept insight
              </Button>
              <Button
                size="sm"
                variant={finding.review_status === "rejected" ? "destructive" : "outline"}
                onClick={() => review("rejected")}
              >
                <X size={14} />
                Reject insight
              </Button>
              {finding.review_status !== "pending" && (
                <Button size="sm" variant="ghost" onClick={() => review("pending")}>
                  Reopen review
                </Button>
              )}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Severity &amp; notes
              </summary>
              <label className="field">
                Severity
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
                  <option value="major">Major friction</option>
                  <option value="blocker">Observed task blocker</option>
                </select>
              </label>
              <label className="field">
                Researcher note
                <textarea
                  rows={3}
                  value={finding.reviewer_note ?? ""}
                  placeholder="Add context or disagreement."
                  onChange={(e) =>
                    void update((s) =>
                      reviewFinding(s, finding.id, { reviewer_note: e.target.value }),
                    )
                  }
                />
              </label>
            </details>
          </section>
          <SuggestedTestPanel finding={finding} update={update} productId={target} />
          {/* Read-only legacy draft; renders nothing unless older data has one. */}
          <NextStepDraft finding={finding} />
        </article>
        <EvidencePanel key={finding.id} session={session} finding={finding} seekMs={seekMs} />
      </div>
    </Shell>
  );
}
