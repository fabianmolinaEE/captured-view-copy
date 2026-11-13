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
import { SharedSessionPanel } from "./SharedSessionPanel";
export function SessionReview({ id }: { id: string }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [time, setTime] = useState(0);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("proposals");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    getSession(id)
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    if (!session?.video_blob) return;
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
    if (video.current && session) {
      video.current.currentTime = Math.max(0, (t + session.video_start_offset_ms) / 1000);
      setTime(t);
    }
  };
  const review = (
    finding: Finding,
    changes: Pick<Partial<Finding>, "review_status" | "reviewer_note" | "severity">,
  ) => {
    if (current.current)
      void persist(reviewFinding(current.current, finding.id, changes)).catch(() => {});
  };
  if (loading)
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
        description={`${new Date(session.captured_at).toLocaleString()} · ${duration(session.duration_ms)} · ${session.events.length} observed events${session.capture_end_reason ? ` · ${label(session.capture_end_reason)}` : ""}`}
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
          Saving or unsaved local changes.{" "}
          <Button variant="outline" size="sm" onClick={() => void persist(current.current!)}>
            Retry local save
          </Button>{" "}
          Export JSON preserves the current document.
        </div>
      )}
      <div className="review-grid">
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold flex gap-2 items-center">
              <Film size={16} />
              Recording
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {session.extension.toUpperCase()} ·{" "}
              {(session.video_blob.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <div className="video-stage">
            <video
              ref={video}
              src={url || undefined}
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
          </div>
          <div className="flex justify-between items-center my-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {duration(time)} / {duration(session.duration_ms)}
            </span>
            <Button
              variant="ghost"
              size="sm"
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
                No interactions were captured before recording stopped.
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
                Observed issues
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
                      run.status === "completed" && run.mode === "video_frames_plus_events"
                        ? "analyzed"
                        : fresh.status,
                  });
                  setSelectedRun(run.id);
                }}
              />
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
              <label className="field">
                Analysis run
                <select value={latest?.id ?? ""} onChange={(e) => setSelectedRun(e.target.value)}>
                  {session.runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.mode === "events_only" ? "Events only" : "Video + events"} ·{" "}
                      {new Date(r.completed_at).toLocaleString()} · {r.status}
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
                  <h3 className="text-sm font-semibold">No proposals yet</h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Only real model results appear here.
                    <br />
                    Your recording and events are ready for review.
                  </p>
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
                      <div className="eyebrow">Observed evidence</div>
                      <p>{f.observed_evidence ?? f.visual_evidence}</p>
                      <div className="eyebrow">Model interpretation</div>
                      <p>{f.interpretation ?? "Not separately provided by this older run."}</p>
                      <p className="text-xs">Review status: {f.review_status}</p>
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
                        <option value="minor">Minor friction</option>
                        <option value="major">Major friction (default estimate)</option>
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
                  {latest.model_name} · {latest.frame_count ?? "Unknown"} frames ·{" "}
                  {latest.error && <span role="alert">{latest.error} · </span>}
                  {latest.latency_ms ?? "Unknown"} ms · Tokens:{" "}
                  {latest.usage?.total_tokens ?? "not reported"} · Cost: unavailable
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
                        category: "rage_or_hesitation",
                        screen: "",
                        actually_observed: "unknown",
                      },
                    ],
                  })
                }
              >
                Add human observed issue
              </Button>
              <p className="text-xs text-muted-foreground mt-5 leading-relaxed">
                A configured defect is not proof it appeared. Check the video, then mark whether
                each issue actually manifested.
              </p>
              {session.issues.map((issue) => (
                <div className="finding" key={issue.id}>
                  <div className="text-sm font-semibold capitalize">{label(issue.category)}</div>
                  <label>Issue category</label>
                  <select
                    className="select-control w-full"
                    value={issue.category}
                    onChange={(e) =>
                      void persist({
                        ...session,
                        issues: session.issues.map((i) =>
                          i.id === issue.id
                            ? { ...i, category: e.target.value as Finding["category"] }
                            : i,
                        ),
                      })
                    }
                  >
                    {[
                      "long_loading",
                      "silent_form_rejection",
                      "silent_failure",
                      "fighting_ui",
                      "missed_button",
                      "rage_or_hesitation",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {label(c)}
                      </option>
                    ))}
                  </select>
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
                  No planted scenarios were enabled for this recording.
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
