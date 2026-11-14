import { Shell, PageHeading } from "./Shell";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Pause, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import {
  competitorOf,
  createCompetitorSession,
  doorDashCandidates,
  type CompetitorCandidate,
} from "@/lib/research/competitors";
import { listSessions, saveSession } from "@/lib/research/sessionStorage";
import { duration, type Session } from "@/lib/research/types";
import { PublicVideoPlayer } from "./PublicVideoPlayer";
import { ScoutMascot } from "./ScoutMascot";
import { ScoutStatusPill } from "./ScoutCard";

/** Default clip: the first three minutes (or the whole video if shorter). Max five minutes. */
const DEFAULT_CLIP_SECONDS = 180;
type LibraryCandidate = CompetitorCandidate;
interface SourceGroup {
  key: "own" | "competitor";
  kicker: string;
  heading: string;
  intro: string;
  candidates: readonly LibraryCandidate[];
  create: (
    candidate: LibraryCandidate,
    durationMs: number,
    startMs: number,
    endMs: number,
  ) => Session;
}
const uberEatsGroup: SourceGroup = {
  key: "own",
  kicker: "Uber Eats · Recording library",
  heading: "Uber Eats recordings",
  intro: "Play a video, then save a clip of up to five minutes.",
  candidates: uberEatsCandidates,
  create: (candidate, durationMs, startMs, endMs) =>
    createPublicSession(
      candidate as (typeof uberEatsCandidates)[number],
      durationMs,
      startMs,
      endMs,
    ),
};
const doorDashGroup: SourceGroup = {
  key: "competitor",
  kicker: "Competitor footage · Explorer",
  heading: `${competitorOf("uber-eats")?.name ?? "DoorDash"} recordings`,
  intro: "Patterns to adopt or avoid. These recordings never count toward Uber Eats metrics.",
  candidates: doorDashCandidates,
  create: (candidate, durationMs, startMs, endMs) =>
    createCompetitorSession(candidate, "uber-eats", durationMs, startMs, endMs),
};

/**
 * In-page library of public recordings. Each candidate plays here through the official embed;
 * saving takes two clicks (Play here → Save clip) once the player has reported the duration.
 */
export function PublicSourceLibrary({
  sessions,
  onSaved,
  includeCompetitors = false,
}: {
  sessions: Session[];
  onSaved: (session: Session) => void;
  /** Adds the Explorer section with the product's competitor (DoorDash for Uber Eats). */
  includeCompetitors?: boolean;
}) {
  const groups = includeCompetitors ? [uberEatsGroup, doorDashGroup] : [uberEatsGroup];
  const saving = useRef(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [selected, setSelected] = useState<{ group: SourceGroup; candidate: LibraryCandidate }>();
  const [durationMs, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const savedFor = (id: string) =>
    sessions.find((session) => session.public_video?.video_id === id);
  const select = (group: SourceGroup, candidate: LibraryCandidate) => {
    setPreviewVersion((version) => version + 1);
    setSelected({ group, candidate });
    setDuration(0);
    setStart(0);
    setEnd(0);
    setEmbedFailed(false);
    setError("");
  };
  const save = async () => {
    if (!selected || saving.current || savedFor(selected.candidate.id)) return;
    saving.current = true;
    setError("");
    setBusy(true);
    try {
      const session = selected.group.create(
        selected.candidate,
        durationMs,
        start * 1000,
        end * 1000,
      );
      await saveSession(session);
      onSaved(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The recording could not be saved.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const preview = (group: SourceGroup) => {
    if (!selected || selected.group.key !== group.key) return null;
    const { candidate } = selected;
    const added = savedFor(candidate.id);
    return (
      <div
        className="public-source-preview"
        key={`${candidate.id}-${previewVersion}`}
        aria-label={`Preview of ${candidate.title}`}
        role="region"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3>{candidate.title}</h3>
            <p className="text-xs text-muted-foreground">
              By {candidate.creator} · {candidate.date} · Plays from YouTube
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(undefined)}
            aria-label="Close preview"
          >
            <Pause size={13} />
            Close
          </Button>
        </div>
        <PublicVideoPlayer
          videoId={candidate.id}
          title={`Preview: ${candidate.title}`}
          onPlaybackError={() => setEmbedFailed(true)}
          onDuration={(ms) => {
            setDuration(ms);
            setEnd(
              (value) =>
                value || Math.max(1, Math.floor(Math.min(ms / 1000, DEFAULT_CLIP_SECONDS))),
            );
          }}
        />
        <p className="text-xs text-muted-foreground">{candidate.context}</p>
        {embedFailed && !added && (
          <p className="text-xs text-muted-foreground">
            Embed blocked. Save it anyway and attach the original video file on its recording page.
          </p>
        )}
        <p className="text-xs">
          {durationMs
            ? `Clip ${duration(start * 1000)}–${duration(end * 1000)} of ${duration(durationMs)}`
            : "Loading the video's duration from the player…"}
        </p>
        {!added && (
          <details className="recording-provenance">
            <summary>Adjust clip</summary>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="field">
                Segment start (seconds)
                <input
                  type="number"
                  min={0}
                  value={start}
                  disabled={busy}
                  onChange={(event) => setStart(Number(event.target.value))}
                />
              </label>
              <label className="field">
                Segment end (seconds)
                <input
                  type="number"
                  min={1}
                  max={durationMs / 1000}
                  value={end}
                  disabled={busy}
                  onChange={(event) => setEnd(Number(event.target.value))}
                />
              </label>
            </div>
            <p>Up to five minutes. Timestamps match the original video.</p>
          </details>
        )}
        {added ? (
          <Button asChild>
            <Link to="/sessions/$id" params={{ id: added.id }}>
              <Check size={14} />
              Open saved recording
            </Link>
          </Button>
        ) : (
          <>
            <Button disabled={!durationMs || busy} onClick={() => void save()}>
              <Save size={14} />
              {busy ? "Saving clip…" : "Reviewed · save clip"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Saving confirms you watched it and it shows nothing sensitive. Only the link and clip
              bounds are stored.
            </p>
          </>
        )}
        {error && (
          <div className="error-note mt-3" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  };
  return (
    <>
      {groups.map((group) => {
        const saved = sessions.filter((session) =>
          group.candidates.some((candidate) => candidate.id === session.public_video?.video_id),
        );
        return (
          <section
            className="public-sources"
            aria-label={group.kicker}
            key={group.key}
            data-source-group={group.key}
            id={`${group.key}-footage`}
          >
            <div className="section-heading">
              <div className="flex items-center gap-3">
                {group.key === "competitor" && (
                  <ScoutMascot scout="explorer" size={52} decorative />
                )}
                <div>
                  <span className="section-kicker">{group.kicker}</span>
                  <h2>{group.heading}</h2>
                </div>
              </div>
              {group.key === "competitor" && <ScoutStatusPill scout="explorer" />}
            </div>
            <p className="public-source-intro">{group.intro}</p>
            <div className="public-source-grid">
              {group.candidates.map((candidate) => {
                const existing = savedFor(candidate.id);
                const active = selected?.candidate.id === candidate.id;
                return (
                  <article className="public-source-card" key={candidate.id}>
                    <span className="status-badge">{existing ? "Saved" : "Available"}</span>
                    <h3>{candidate.title}</h3>
                    <p>
                      {candidate.creator} · {candidate.date}
                    </p>
                    <div>
                      <Button
                        variant={active ? "default" : "outline"}
                        size="sm"
                        disabled={busy}
                        aria-label={`Play ${candidate.title} here`}
                        onClick={() => select(group, candidate)}
                      >
                        <Play size={13} />
                        Play here
                      </Button>
                      {existing && (
                        <Link to="/sessions/$id" params={{ id: existing.id }}>
                          Open recording
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {preview(group)}
            {group.key === "competitor" && (
              <p className="mt-4 text-xs text-muted-foreground">
                {saved.length
                  ? `${saved.length} saved competitor ${saved.length === 1 ? "recording" : "recordings"} · kept out of Uber Eats metrics`
                  : "No competitor recordings saved yet."}
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

/** Uber Eats-only library, used by the Add recording page. */
export function UberEatsSources({
  sessions,
  onSaved,
}: {
  sessions: Session[];
  onSaved: (session: Session) => void;
}) {
  return <PublicSourceLibrary sessions={sessions} onSaved={onSaved} />;
}

export function UberEatsSetup() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Could not open local recordings."),
      );
  }, []);
  return (
    <Shell section="Add recording">
      <PageHeading
        title="Add recording"
        description="Add an Uber Eats video for Tracker to analyze."
      />
      {error && <p className="error-note">{error}</p>}
      <UberEatsSources
        sessions={sessions}
        onSaved={(session) => {
          setSessions((current) => [session, ...current]);
          void navigate({ to: "/sessions/$id", params: { id: session.id } });
        }}
      />
      <p className="text-xs text-muted-foreground">
        DoorDash footage for Explorer is on the{" "}
        <Link to="/sessions" className="text-primary underline-offset-4 hover:underline">
          Recordings
        </Link>{" "}
        page.
      </p>
    </Shell>
  );
}
