import { PublicVideoPlayer } from "./PublicVideoPlayer";
import { attachOriginalVideo } from "@/lib/research/videoAttachment";
import {
  evidenceDuration,
  isPublicVideo,
  pregeneratedLabel,
  publicSessionNotes,
} from "@/lib/research/publicVideo";
import { evidenceProductOf, useEvidenceProduct } from "@/hooks/use-product";
import { productNameForSource, products } from "@/lib/research/products";
import { competitorOf, isCompetitorSession } from "@/lib/research/competitors";
import { ScoutMascot } from "./ScoutMascot";
import { ScoutStatusPill } from "./ScoutCard";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Trash2,
  Sparkles,
  Film,
  List,
  Check,
  X,
  Clock3,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, PageHeading } from "./Shell";
import {
  deleteSession,
  downloadFile,
  exportSession,
  getSession,
  saveSession,
} from "@/lib/research/sessionStorage";
import { duration, label, type Session, type Finding } from "@/lib/research/types";
import { AnalysisPanel } from "./AnalysisPanel";
import { reviewFinding } from "@/lib/research/review";
import { testDecisionOf } from "@/lib/research/testDecisions";
import { discardRunsForFinding, discardRunsForSession } from "@/lib/research/simulation";
import { SharedSessionPanel } from "./SharedSessionPanel";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { notifySessionsChanged } from "@/lib/research/demo/importTrackerRuns";
import { useFrameThumbnail } from "@/lib/research/evidence";
/** `#t=<ms>` deep link on the session timeline, or 0 (SSR-safe). */
function initialHashMs() {
  try {
    if (typeof window === "undefined") return 0;
    const t = Number(new URLSearchParams(window.location.hash.slice(1)).get("t"));
    return Number.isFinite(t) && t > 0 ? t : 0;
  } catch {
    return 0;
  }
}
/** Opens at a `#t=<ms>` deep link inside the saved clip, otherwise at the clip start. */
function initialHostedMs(source: NonNullable<Session["public_video"]>) {
  try {
    const t = Number(new URLSearchParams(window.location.hash.slice(1)).get("t"));
    if (Number.isFinite(t) && t >= source.start_ms && t <= source.end_ms) return t;
  } catch {
    /* No usable deep link. */
  }
  return source.start_ms;
}
export function SessionReview({ id }: { id: string }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>();
  const productMatches = useEvidenceProduct(session);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hostedSeek, setHostedSeek] = useState<{ ms: number; token: number }>();
  const [embedFailed, setEmbedFailed] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [url, setUrl] = useState("");
  const [time, setTime] = useState(0);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("proposals");
  const video = useRef<HTMLVideoElement>(null);
  const [posterMs] = useState(initialHashMs);
  // Without a poster, a metadata-only <video> can stay black until it plays.
  const poster = useFrameThumbnail(
    session?.video_blob?.size ? session.video_blob : undefined,
    posterMs + (session?.video_start_offset_ms ?? 0),
    session?.id,
  );
  useEffect(() => {
    setHostedSeek(undefined);
    setEmbedFailed(false);
    getSession(id)
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  // A direct link can load before the automatic Tracker import has written this session.
  useSessionsChanged((event) => {
    if (current.current) return;
    const added = event?.detail?.added;
    if (added?.length && !added.includes(id)) return;
    getSession(id)
      .then((value) => {
        if (value && !current.current) setSession(value);
      })
      .catch(() => {
        /* The initial load already reported any storage error. */
      });
  });
  useEffect(() => {
    if (!session?.video_blob.size) return;
    const objectUrl = URL.createObjectURL(session.video_blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [session?.video_blob]);
  const current = useRef<Session | undefined>(undefined);
  current.current = session;
  const saveQueue = useRef(Promise.resolve());
  const [unsaved, setUnsaved] = useState(false);
  const [selectedRun, setSelectedRun] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");
  const persist = async (updated: Session, markDirty = true) => {
    const next =
      updated.sync && markDirty
        ? { ...updated, sync: { ...updated.sync, state: "local_changes" as const } }
        : updated;
    current.current = next;
    setSession(next);
    setUnsaved(true);
    const pending = saveQueue.current.catch(() => {}).then(() => saveSession(next));
    saveQueue.current = pending.then(
      () => {},
      () => {},
    );
    try {
      await pending;
      if (current.current === next) setUnsaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    }
  };
  const seek = (t: number) => {
    if (session?.public_video && !session.video_blob.size) {
      // Public timestamps are on the original video's timeline. A new token re-seeks and plays,
      // even when the same highlight is chosen twice.
      setHostedSeek((current) => ({ ms: t, token: (current?.token ?? 0) + 1 }));
      setTime(t);
      return;
    }
    if (video.current && session) {
      video.current.currentTime = Math.max(0, (t + session.video_start_offset_ms) / 1000);
      setTime(t);
    }
  };
  const review = (
    finding: Finding,
    changes: Pick<Partial<Finding>, "review_status" | "reviewer_note" | "severity">,
  ) => {
    if (!current.current) return;
    // Withdrawing an accepted insight resets its approved test; its simulated runs go with it,
    // matching Insight detail and the suggested-test panel.
    const before = current.current.findings.find((f) => f.id === finding.id) ?? finding;
    const withdrawn =
      testDecisionOf(before) === "approved" &&
      changes.review_status !== undefined &&
      changes.review_status !== "accepted";
    void persist(reviewFinding(current.current, finding.id, changes))
      .then(() => {
        if (withdrawn) discardRunsForFinding(finding.id);
      })
      .catch(() => {});
  };
  if (session && !evidenceProductOf(session))
    return (
      <Shell section="Session review">
        <div className="empty-sessions">
          <h2>Archived recording</h2>
          <p>Not linked to a current product. Kept unchanged in this browser.</p>
          <Button variant="outline" onClick={() => exportSession(session)}>
            Export recording data
          </Button>
        </div>
      </Shell>
    );
  if (loading || (session && !productMatches))
    return (
      <Shell section="Session review">
        <p className="text-sm text-muted-foreground">Opening recording…</p>
      </Shell>
    );
  if (!session)
    return (
      <Shell section="Session review">
        <PageHeading
          title="Session unavailable"
          description={error || "This session was deleted or belongs to another browser."}
        />
        <Button asChild>
          <Link to="/sessions">Back to sessions</Link>
        </Button>
      </Shell>
    );
  const latest = session.runs.find((r) => r.id === selectedRun) ?? session.runs.at(-1);
  const findings = latest ? session.findings.filter((f) => f.analysis_run_id === latest.id) : [];
  const competitorFootage = isCompetitorSession(session);
  const comparedProductId = competitorFootage ? evidenceProductOf(session) : undefined;
  const comparedProduct = products.find((product) => product.id === comparedProductId);
  const competitorName = competitorOf(comparedProductId)?.name ?? session.source_app;
  const publicSource = session.public_video;
  const hostedOnly = !!publicSource && !session.video_blob.size;
  return (
    <Shell section="Session review">
      <Link
        to="/sessions"
        className="text-xs text-muted-foreground flex items-center gap-2 mb-5 no-underline"
      >
        <ArrowLeft size={13} />
        All sessions
      </Link>
      <PageHeading
        title={session.title}
        description={`${competitorFootage ? `Competitor footage · ${competitorName}` : productNameForSource(session.source_app)} · ${new Date(session.captured_at).toLocaleString()} · ${
          publicSource
            ? `Clip ${duration(publicSource.start_ms)}–${duration(publicSource.end_ms)} (${duration(evidenceDuration(session))}) · Public video, no interaction events`
            : `${duration(session.duration_ms)} · ${session.events.length} observed events`
        }${session.capture_end_reason ? ` · ${label(session.capture_end_reason)}` : ""}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportSession(session)}>
              <Download />
              Export JSON
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Delete recording"
              aria-label="Delete recording"
              onClick={async () => {
                if (
                  window.confirm("Delete the video, events, findings and labels for this session?")
                ) {
                  await deleteSession(id);
                  discardRunsForSession(id);
                  notifySessionsChanged();
                  await navigate({ to: "/sessions" });
                }
              }}
            >
              <Trash2 />
            </Button>
          </div>
        }
      />
      {error && (
        <div className="error-note mb-5" role="alert">
          {error}
        </div>
      )}
      {unsaved && (
        <div className="info-note mb-3">
          Unsaved changes.{" "}
          <Button variant="outline" size="sm" onClick={() => void persist(current.current!)}>
            Retry local save
          </Button>{" "}
          Export JSON keeps a copy.
        </div>
      )}
      {competitorFootage && (
        <aside
          className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-xs"
          aria-label="Explorer competitor footage"
        >
          <ScoutMascot scout="explorer" size={44} decorative />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong>Explorer · Competitor footage</strong>
              <ScoutStatusPill scout="explorer" />
            </div>
            <p className="mt-1 text-muted-foreground">
              {competitorName} footage: patterns to adopt or avoid in{" "}
              {comparedProduct?.name ?? "your product"}, and never counts toward its insights or
              metrics.
            </p>
          </div>
        </aside>
      )}
      <div className="review-grid">
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold flex gap-2 items-center">
              <Film size={16} />
              Recording
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {session.video_blob.size
                ? `${session.extension.toUpperCase()} · ${(session.video_blob.size / 1024 / 1024).toFixed(1)} MB`
                : "YouTube"}
            </span>
          </div>
          <div className="video-stage">
            {publicSource && hostedOnly ? (
              <PublicVideoPlayer
                videoId={publicSource.video_id}
                title={`Recording: ${session.title}`}
                startMs={hostedSeek?.ms ?? initialHostedMs(publicSource)}
                endMs={publicSource.end_ms}
                clipEndMs={publicSource.end_ms}
                playToken={hostedSeek?.token ?? 0}
                onTimeUpdate={setTime}
                onPlaybackError={() => setEmbedFailed(true)}
              />
            ) : (
              <video
                ref={video}
                src={url || undefined}
                poster={poster ?? undefined}
                controls
                onLoadedMetadata={() => {
                  const t = Number(new URLSearchParams(location.hash.slice(1)).get("t"));
                  if (Number.isFinite(t) && t > 0) seek(t);
                }}
                preload="metadata"
                onTimeUpdate={(e) =>
                  setTime(
                    Math.max(0, e.currentTarget.currentTime * 1000 - session.video_start_offset_ms),
                  )
                }
                onError={() =>
                  setError(
                    "This browser could not play the saved recording. Try downloading it or using the browser that captured it.",
                  )
                }
              />
            )}
          </div>
          {publicSource && (
            <>
              <p className="mt-2 text-[11px] text-muted-foreground">
                By {publicSource.creator} · {publicSource.published_label} · Clip{" "}
                {duration(publicSource.start_ms)}–{duration(publicSource.end_ms)} of the original
                video
              </p>
              {(publicSessionNotes(session).length > 0 || pregeneratedLabel(session)) && (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Recording notes">
                  {[...publicSessionNotes(session), pregeneratedLabel(session)]
                    .filter((note): note is string => !!note)
                    .map((note) => (
                      <span
                        key={note}
                        className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {note}
                      </span>
                    ))}
                </div>
              )}
              {embedFailed && hostedOnly && (
                <p className="info-note mt-2" role="status">
                  Can't play here. Use Watch on YouTube, or attach the original video file below.
                </p>
              )}
              <label className="field video-attachment">
                {attaching
                  ? "Attaching video…"
                  : session.video_blob.size
                    ? "Replace video file"
                    : "Attach original video for local playback"}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  disabled={attaching}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file || !current.current) return;
                    setAttaching(true);
                    setError("");
                    try {
                      const original = current.current;
                      const attached = await attachOriginalVideo(original, file);
                      if (current.current?.id !== original.id) return;
                      await persist({
                        ...current.current,
                        video_blob: attached.video_blob,
                        mime_type: attached.mime_type,
                        extension: attached.extension,
                      });
                    } catch (reason) {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : "The video could not be attached.",
                      );
                    } finally {
                      setAttaching(false);
                    }
                  }}
                />
              </label>
              <details className="recording-provenance">
                <summary>Recording details</summary>
                <p>{publicSource.context}</p>
                <p>Source link: {publicSource.url}</p>
              </details>
            </>
          )}
          <div className="flex justify-between items-center my-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {duration(time)} / {duration(session.duration_ms)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!session.video_blob.size}
              onClick={() =>
                downloadFile(session.video_blob, `loopmate-${session.id}.${session.extension}`)
              }
            >
              <Download />
              Download recording
            </Button>
          </div>
          {findings.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {findings.map((f) => (
                <Button
                  key={f.id}
                  variant="outline"
                  size="sm"
                  title={f.title}
                  onClick={() => seek(f.timestamp_ms)}
                >
                  <Clock3 />
                  {duration(f.timestamp_ms)}
                </Button>
              ))}
            </div>
          )}
          {!publicSource && (
            <>
              <div className="flex items-center justify-between mt-6">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <List size={16} />
                  Interaction events{" "}
                  <span className="text-muted-foreground text-xs">{session.events.length}</span>
                </h2>
                <select
                  className="select-control py-1.5"
                  aria-label="Filter event type"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All events</option>
                  {[...new Set(session.events.map((e) => e.type))].sort().map((t) => (
                    <option key={t} value={t}>
                      {label(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="events-list">
                {session.events
                  .filter((e) => filter === "all" || e.type === filter)
                  .map((e) => (
                    <Button
                      key={e.id}
                      variant="ghost"
                      className={`event-row ${Math.abs(e.t_ms - time) <= 2000 ? "current" : ""}`}
                      onClick={() => seek(e.t_ms)}
                    >
                      <time>{duration(e.t_ms)}</time>
                      <span>
                        {label(e.type)}
                        <small>
                          {e.screen}
                          {e.target_id ? ` · ${e.target_id}` : ""}
                          {e.metadata?.["hit"] === false ? " · Missed target" : ""}
                        </small>
                      </span>
                      <ArrowUpRight size={12} className="ml-auto shrink-0" />
                    </Button>
                  ))}
                {!session.events.length && (
                  <p className="text-xs text-muted-foreground p-4">
                    No interaction events are attached to this recording.
                  </p>
                )}
              </div>
              <label className="field mt-5">
                Video calibration offset (milliseconds)
                <input
                  type="number"
                  min={-5000}
                  max={5000}
                  step={100}
                  value={session.video_start_offset_ms}
                  onChange={(e) =>
                    void persist({ ...session, video_start_offset_ms: Number(e.target.value) })
                  }
                />
              </label>
            </>
          )}
        </section>
        <section>
          <div className="section-toolbar">
            <div className="filter-tabs">
              <Button
                variant="ghost"
                className={`filter-tab ${tab === "proposals" ? "selected" : ""}`}
                onClick={() => setTab("proposals")}
              >
                AI proposals <span>{findings.length}</span>
              </Button>
              <Button
                variant="ghost"
                className={`filter-tab ${tab === "labels" ? "selected" : ""}`}
                onClick={() => setTab("labels")}
              >
                Observed opportunities
              </Button>
            </div>
          </div>
          {tab === "proposals" ? (
            <>
              <div className="flex gap-4 text-[11px] text-muted-foreground mt-4 mb-5">
                {["pending", "accepted", "rejected"].map((s) => (
                  <span key={s}>
                    {findings.filter((f) => f.review_status === s).length} {s}
                  </span>
                ))}
              </div>
              <AnalysisPanel
                session={session}
                onError={setError}
                onResult={async (run, proposals) => {
                  const fresh = current.current!;
                  await persist({
                    ...fresh,
                    runs: [...fresh.runs, run],
                    findings: [...fresh.findings, ...proposals],
                    status:
                      run.status === "completed" && run.mode !== "events_only"
                        ? "analyzed"
                        : fresh.status,
                  });
                  setSelectedRun(run.id);
                }}
              />
              {!isPublicVideo(session) && (
                <SharedSessionPanel
                  session={session}
                  onSynced={(next) => {
                    const fresh = current.current!;
                    const merged = {
                      ...fresh,
                      ...(next.sync
                        ? {
                            sync: {
                              ...next.sync,
                              state:
                                JSON.stringify({
                                  ...fresh,
                                  video_blob: undefined,
                                  sync: undefined,
                                }) ===
                                JSON.stringify({ ...next, video_blob: undefined, sync: undefined })
                                  ? ("synced" as const)
                                  : ("local_changes" as const),
                            },
                          }
                        : {}),
                    };
                    if (!next.sync) delete merged.sync;
                    void persist(merged, false);
                  }}
                  onError={setError}
                />
              )}
              <label className="field">
                Analysis run
                <select value={latest?.id ?? ""} onChange={(e) => setSelectedRun(e.target.value)}>
                  {session.runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.mode === "events_only"
                        ? "Events only"
                        : r.mode === "public_video"
                          ? "Video recording"
                          : "Video + events"}{" "}
                      · {new Date(r.completed_at).toLocaleString()} · {r.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Review status
                <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
                  {["all", "pending", "accepted", "rejected"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              {findings.length === 0 ? (
                <div className="text-center py-14">
                  <Sparkles className="text-muted-foreground mx-auto mb-4" size={25} />
                  {latest?.status === "completed" && latest.mode === "public_video" ? (
                    <>
                      <h3 className="text-sm font-semibold">
                        {isCompetitorSession(session) ? "Explorer" : "Tracker"} found no insights in
                        this clip
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        Zero findings returned. Nothing was invented.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold">No proposals yet</h3>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        Only real model results appear here.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                findings
                  .filter((f) => reviewFilter === "all" || f.review_status === reviewFilter)
                  .map((f) => (
                    <div className="finding" key={f.id}>
                      <div className="flex justify-between items-center">
                        <span className="status-badge">{label(f.category)}</span>
                        <Button variant="ghost" size="sm" onClick={() => seek(f.timestamp_ms)}>
                          <Clock3 />
                          {duration(f.timestamp_ms)}
                        </Button>
                      </div>
                      <h3>
                        <Link
                          to="/insights/$sessionId/$findingId"
                          params={{ sessionId: session.id, findingId: f.id }}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {f.title}
                        </Link>
                      </h3>
                      <p>{f.description}</p>
                      {f.recommendation && (
                        <div className="suggested-improvement">
                          <div className="eyebrow">Suggested improvement</div>
                          <p>{f.recommendation}</p>
                          {f.expected_benefit && <p>{f.expected_benefit}</p>}
                        </div>
                      )}
                      <details className="recording-provenance">
                        <summary>Evidence and interpretation</summary>
                        <div className="eyebrow">Observed evidence</div>
                        <p>{f.observed_evidence ?? f.visual_evidence}</p>
                        <div className="eyebrow">Model interpretation</div>
                        <p>{f.interpretation ?? "Not separately provided by this older run."}</p>
                        <div className="eyebrow">Visible evidence</div>
                        <p>{f.visual_evidence}</p>
                        <div className="eyebrow">What video contributes</div>
                        <p>{f.why_video_matters}</p>
                        <span className="text-[10px] text-muted-foreground">
                          Model confidence {Math.round(f.confidence * 100)}% ·{" "}
                          {f.evidence_sources.join(" + ")}
                        </span>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {f.event_ids.map((eventId) => {
                            const event = session.events.find((e) => e.id === eventId);
                            return event ? (
                              <Button
                                key={eventId}
                                size="sm"
                                variant="outline"
                                onClick={() => seek(event.t_ms)}
                              >
                                {label(event.type)}
                              </Button>
                            ) : null;
                          })}
                        </div>
                      </details>
                      <p className="text-xs mt-3">Review status: {f.review_status}</p>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant={f.review_status === "accepted" ? "default" : "outline"}
                          onClick={() => review(f, { review_status: "accepted" })}
                        >
                          <Check />
                          Accept finding
                        </Button>
                        <Button
                          size="sm"
                          variant={f.review_status === "rejected" ? "destructive" : "outline"}
                          onClick={() => review(f, { review_status: "rejected" })}
                        >
                          <X />
                          Reject finding
                        </Button>
                      </div>
                      <label>Researcher severity estimate</label>
                      <select
                        className="select-control w-full"
                        value={f.severity ?? "major"}
                        onChange={(e) =>
                          review(f, { severity: e.target.value as "minor" | "major" | "blocker" })
                        }
                      >
                        <option value="minor">Small improvement</option>
                        <option value="major">Meaningful improvement (default estimate)</option>
                        <option value="blocker">Observed task blocker</option>
                      </select>
                      <label>Reviewer note</label>
                      <textarea
                        aria-label={`Reviewer note for ${f.title}`}
                        value={f.reviewer_note ?? ""}
                        onChange={(e) => review(f, { reviewer_note: e.target.value })}
                      />
                    </div>
                  ))
              )}
              {latest && (
                <div className="info-note">
                  {latest.status === "completed" ? "Actual model" : "Requested model (failed)"}:{" "}
                  {latest.model_name} ·{" "}
                  {latest.mode === "public_video"
                    ? "Video recording"
                    : `${latest.frame_count ?? "Unknown"} sampled frames`}{" "}
                  · {latest.error && <span role="alert">{latest.error} · </span>}
                  {latest.latency_ms ?? "Unknown"} ms · Tokens:{" "}
                  {latest.usage?.total_tokens ?? "not reported"} · Cost: unavailable
                  {session.pregenerated?.run_ids.includes(latest.id) && (
                    <> · {pregeneratedLabel(session)}; not counted toward today&apos;s cap</>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  void persist({
                    ...session,
                    issues: [
                      ...session.issues,
                      {
                        id: crypto.randomUUID(),
                        category: "usability",
                        screen: "",
                        actually_observed: "unknown",
                      },
                    ],
                  })
                }
              >
                Add observed opportunity
              </Button>
              <p className="text-xs text-muted-foreground mt-5 leading-relaxed">
                Note what you saw, independently of the AI.
              </p>
              {session.issues.map((issue) => (
                <div className="finding" key={issue.id}>
                  <div className="text-sm font-semibold capitalize">{label(issue.category)}</div>
                  <label>Topic</label>
                  <input
                    className="select-control w-full"
                    value={issue.category}
                    onChange={(event) =>
                      void persist({
                        ...session,
                        issues: session.issues.map((entry) =>
                          entry.id === issue.id
                            ? { ...entry, category: event.target.value }
                            : entry,
                        ),
                      })
                    }
                  />
                  <label>Observed screen</label>
                  <input
                    value={issue.screen}
                    onChange={(e) =>
                      void persist({
                        ...session,
                        issues: session.issues.map((i) =>
                          i.id === issue.id ? { ...i, screen: e.target.value } : i,
                        ),
                      })
                    }
                  />
                  <p>Expected screen: {label(issue.screen)}</p>
                  <label>Actually observed in this recording</label>
                  <select
                    className="select-control w-full"
                    value={issue.actually_observed}
                    onChange={(e) =>
                      void persist({
                        ...session,
                        issues: session.issues.map((i) =>
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
                    <option value="yes">Yes — observed</option>
                    <option value="no">No — not observed</option>
                  </select>
                  <label>Evidence notes</label>
                  <textarea
                    aria-label={`Evidence notes for ${issue.category}`}
                    value={issue.notes ?? ""}
                    onChange={(e) =>
                      void persist({
                        ...session,
                        issues: session.issues.map((i) =>
                          i.id === issue.id ? { ...i, notes: e.target.value } : i,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              {!session.issues.length && (
                <p className="text-xs text-muted-foreground mt-8">
                  {publicSource
                    ? "No planted scenarios. Add what you verify in the footage."
                    : "No planted scenarios were enabled for this recording."}
                </p>
              )}
              <Button asChild variant="outline" className="mt-5">
                <Link to="/evaluation">
                  Evaluate results
                  <ArrowUpRight />
                </Link>
              </Button>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
