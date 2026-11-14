import { useEffect, useRef, useState } from "react";
import { PublicVideoPlayer } from "./PublicVideoPlayer";
import { Link } from "@tanstack/react-router";
import { Film, Play, Clock3, ArrowUpRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { highlightRange, useFrameThumbnail } from "@/lib/research/evidence";
import { isCompetitorSession } from "@/lib/research/competitors";
import { youtubeThumbnailUrl } from "@/lib/research/publicVideo";
import { duration, label, type Session, type Finding } from "@/lib/research/types";

/**
 * Evidence timestamps for a finding: its own start and (when given) end timestamp plus cited
 * events, unique and sorted. Matches the chips on Insights cards, so a chip clicked there opens
 * here with the same chip pressed.
 */
function highlightTimes(session: Session, finding: Finding, limit = 5) {
  const cited = session.events
    .filter((event) => finding.event_ids.includes(event.id))
    .map((event) => event.t_ms);
  return [...new Set([finding.timestamp_ms, finding.end_timestamp_ms, ...cited])]
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b)
    .slice(0, limit);
}

function HighlightChips({
  times,
  active,
  onPlay,
}: {
  times: number[];
  active: number | null;
  onPlay: (t: number) => void;
}) {
  if (!times.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Evidence highlights">
      {times.map((t) => (
        <button
          type="button"
          key={t}
          aria-pressed={active === t}
          aria-label={`Play highlight at ${duration(t)}`}
          onClick={() => onPlay(t)}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            active === t
              ? "border-primary bg-accent text-primary"
              : "border-border text-muted-foreground hover:border-primary hover:text-primary"
          }`}
        >
          <Play size={10} />
          {duration(t)}
        </button>
      ))}
    </div>
  );
}

/**
 * Highlight thumbnail for a finding's moment. Public YouTube sessions have no saved video bytes,
 * so they show YouTube's public poster image (not the frame at `timeMs`; see youtubeThumbnailUrl)
 * with the timestamp overlaid. Local recordings show the real frame at `timeMs`. Anything that
 * cannot load falls back to a styled placeholder, never a black box. Decorative: the
 * surrounding link or button carries the accessible name.
 *
 * Not rendered in Insights or HQ (team decision, Nov 13: no thumbnails there). Kept, with its
 * tests, for future non-list evidence views such as a recording picker.
 */
export function EvidenceThumbnail({
  session,
  timeMs,
  className = "",
}: {
  session: Pick<Session, "id" | "video_blob" | "video_start_offset_ms" | "public_video">;
  timeMs: number;
  className?: string;
}) {
  const local = session.video_blob?.size ? session.video_blob : undefined;
  const frame = useFrameThumbnail(local, timeMs + (session.video_start_offset_ms ?? 0), session.id);
  const poster =
    !local && session.public_video ? youtubeThumbnailUrl(session.public_video.video_id) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const src = frame ?? (poster && failed !== poster ? poster : null);
  return (
    <span
      aria-hidden
      data-testid="evidence-thumbnail"
      data-kind={frame ? "frame" : src ? "poster" : "placeholder"}
      className={`relative block aspect-video shrink-0 overflow-hidden rounded-md border border-[#ffffff1f] bg-[radial-gradient(ellipse_at_30%_20%,#c6a7f12e,transparent_65%),radial-gradient(ellipse_at_80%_90%,#8fd6c824,transparent_60%),#17122a] ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Film
          size={18}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#cfb2ef] opacity-60"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-[#0b0816b3] via-transparent to-transparent" />
      <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0b0816a6] text-white ring-1 ring-[#ffffff40]">
        <Play size={12} className="translate-x-px" fill="currentColor" />
      </span>
      <span className="absolute bottom-1 right-1 rounded bg-[#0b0816cc] px-1 py-px font-mono text-[10px] leading-tight text-white">
        {duration(timeMs)}
      </span>
    </span>
  );
}

/** Playback ranges share the session timeline and calibration; no new clip files are uploaded. */
export function EvidencePanel({
  session,
  finding,
  seekMs,
}: {
  session: Session;
  finding: Finding;
  /** Opens the video at this evidence timestamp (from an Insights highlight chip). */
  seekMs?: number | undefined;
}) {
  const initial = seekMs ?? finding.timestamp_ms;
  const times = highlightTimes(session, finding);
  const [active, setActive] = useState<number | null>(seekMs ?? null);
  const [publicPlay, setPublicPlay] = useState({
    start: initial,
    end: session.public_video?.end_ms,
    token: 0,
  });
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [playingClip, setPlayingClip] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const clip = useRef<ReturnType<typeof highlightRange> | null>(null);
  const linked = session.events.filter((event) => finding.event_ids.includes(event.id));
  // Without a poster, a metadata-only <video> can stay black until it plays.
  const poster = useFrameThumbnail(
    session.video_blob.size ? session.video_blob : undefined,
    initial + session.video_start_offset_ms,
    session.id,
  );
  useEffect(() => {
    if (!session.video_blob.size) return;
    const objectUrl = URL.createObjectURL(session.video_blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [session.video_blob]);
  useEffect(() => {
    clip.current = null;
    setPublicPlay({ start: initial, end: session.public_video?.end_ms, token: 0 });
    setActive(seekMs ?? null);
    setPlayingClip(false);
    setError("");
    setEmbedFailed(false);
    if (video.current) {
      video.current.pause();
      video.current.currentTime = Math.max(0, (initial + session.video_start_offset_ms) / 1000);
    }
  }, [finding.id, initial, seekMs, session.video_start_offset_ms, session.public_video?.end_ms]);
  const seek = (timestamp: number) => {
    if (!video.current) return;
    clip.current = null;
    setPlayingClip(false);
    video.current.currentTime = Math.max(0, (timestamp + session.video_start_offset_ms) / 1000);
  };
  const play = async (at = finding.timestamp_ms) => {
    if (!video.current) return;
    setError("");
    setActive(at);
    const range = highlightRange(
      at,
      session.duration_ms,
      session.video_start_offset_ms,
      Number.isFinite(video.current.duration) ? video.current.duration * 1000 : Infinity,
    );
    if (range.end_ms <= range.start_ms) {
      setError("This timestamp is outside the playable recording.");
      return;
    }
    clip.current = range;
    video.current.currentTime = range.start_ms / 1000;
    try {
      await video.current.play();
      setPlayingClip(true);
    } catch {
      clip.current = null;
      setPlayingClip(false);
      setError("Playback could not start. Try the video controls.");
    }
  };
  if (session.public_video && !session.video_blob.size) {
    const source = session.public_video;
    const findingEnd =
      typeof finding.end_timestamp_ms === "number" &&
      Number.isFinite(finding.end_timestamp_ms) &&
      finding.end_timestamp_ms > finding.timestamp_ms
        ? finding.end_timestamp_ms
        : undefined;
    /** Plays ~4s around `at`; with `through`, extends to cover the finding's own end time. */
    const playPublic = (at: number, through?: number) => {
      setActive(at);
      const range = highlightRange(at - source.start_ms, source.end_ms - source.start_ms);
      const start = range.start_ms + source.start_ms;
      let end = range.end_ms + source.start_ms;
      if (through !== undefined && through > at)
        end = Math.max(end, Math.min(source.end_ms, through + 1000));
      setPublicPlay((current) => ({ start, end, token: current.token + 1 }));
    };
    return (
      <aside className="evidence-panel" aria-label="Finding evidence">
        <div className="evidence-panel-heading">
          <span>
            <Film size={16} />
            The evidence
          </span>
          <span className="status-badge">
            {isCompetitorSession(session) ? "Competitor public video" : "Public video"}
          </span>
        </div>
        <PublicVideoPlayer
          videoId={source.video_id}
          startMs={publicPlay.start}
          endMs={publicPlay.end}
          playToken={publicPlay.token}
          clipEndMs={source.end_ms}
          onPlaybackError={() => setEmbedFailed(true)}
        />
        {embedFailed && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            Embed unavailable here. Use Watch on YouTube.
          </p>
        )}
        <div className="highlight-toolbar">
          <Button size="sm" onClick={() => playPublic(finding.timestamp_ms, findingEnd)}>
            <Play size={13} />
            {findingEnd !== undefined ? "Play highlight" : "Play ~4s highlight"}
          </Button>
          <span>
            {duration(finding.timestamp_ms)}
            {findingEnd !== undefined ? `–${duration(findingEnd)}` : ""} · Original timeline
          </span>
        </div>
        <HighlightChips times={times} active={active} onPlay={(t) => playPublic(t)} />
        <details className="recording-provenance">
          <summary>Recording details</summary>
          <p>
            {source.creator} · {source.published_label}
          </p>
          <a href={source.url} target="_blank" rel="noopener">
            Original source ↗
          </a>
        </details>
        <div className="evidence-description">
          <h3>What the model points to</h3>
          <p>{finding.visual_evidence}</p>
        </div>
        <Button asChild variant="outline" className="w-full mt-5">
          <Link to="/sessions/$id" params={{ id: session.id }}>
            Open recording
          </Link>
        </Button>
      </aside>
    );
  }
  return (
    <aside className="evidence-panel" aria-label="Finding evidence">
      <div className="evidence-panel-heading">
        <span>
          <Film size={16} />
          The evidence
        </span>
        <span className="status-badge">Recording</span>
      </div>
      {session.video_blob.size ? (
        <div className="evidence-video">
          <video
            ref={video}
            src={url || undefined}
            poster={poster ?? undefined}
            controls
            preload="metadata"
            aria-label="Recording supporting this finding"
            onLoadedMetadata={() => seek(initial)}
            onError={() =>
              setError(
                "This recording could not be played here. Open the full session to download the original video.",
              )
            }
            onTimeUpdate={() => {
              if (
                video.current &&
                clip.current &&
                video.current.currentTime * 1000 >= clip.current.end_ms
              ) {
                video.current.pause();
                clip.current = null;
                setPlayingClip(false);
              }
            }}
            onPause={() => setPlayingClip(false)}
            onEnded={() => {
              clip.current = null;
              setPlayingClip(false);
            }}
          />
        </div>
      ) : (
        <div className="info-note">No video attached.</div>
      )}
      <div className="highlight-toolbar">
        <Button size="sm" disabled={!url} onClick={() => void play()}>
          <Play size={13} />
          {playingClip ? "Replay highlight" : "Play ~4s highlight"}
        </Button>
        <span>
          <Clock3 size={12} />
          {duration(finding.timestamp_ms)}
        </span>
      </div>
      {url && <HighlightChips times={times} active={active} onPlay={(t) => void play(t)} />}
      {error && (
        <div className="error-note my-3" role="alert">
          {error}
        </div>
      )}
      {!finding.evidence_sources.includes("video") && (
        <div className="info-note mt-4">Events-only analysis: the model didn't see this video.</div>
      )}
      {finding.visual_evidence && (
        <div className="evidence-description">
          <h3>What the model points to</h3>
          <p>{finding.visual_evidence}</p>
        </div>
      )}
      <div className="evidence-events">
        <h3>
          <List size={15} />
          Cited interaction events<span>{linked.length}</span>
        </h3>
        {linked.map((event) => (
          <button
            type="button"
            key={event.id}
            onClick={() => seek(event.t_ms)}
            className="cited-event"
          >
            <time>{duration(event.t_ms)}</time>
            <span>
              {label(event.type)}
              <small>
                {label(event.screen)}
                {event.target_id ? ` · ${event.target_id}` : ""}
                {event.metadata?.["source"] === "local_simulated_backend"
                  ? " · Simulated app event"
                  : ""}
              </small>
            </span>
            <ArrowUpRight size={13} />
          </button>
        ))}
        {!linked.length && <p className="evidence-caption">No events cited.</p>}
        {finding.event_ids.length > linked.length && (
          <p className="error-note">Some cited events are missing from this saved session.</p>
        )}
      </div>
      <Button asChild variant="outline" className="w-full mt-5">
        <Link to="/sessions/$id" params={{ id: session.id }} hash={`t=${finding.timestamp_ms}`}>
          Open full recording
          <ArrowUpRight size={14} />
        </Link>
      </Button>
    </aside>
  );
}
