import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Film, Play, Clock3, ArrowUpRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { highlightRange } from "@/lib/research/evidence";
import { duration, label, type Session, type Finding } from "@/lib/research/types";

/** Playback ranges share the session timeline and calibration; no new clip files are uploaded. */
export function EvidencePanel({ session, finding }: { session: Session; finding: Finding }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [playingClip, setPlayingClip] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const clip = useRef<ReturnType<typeof highlightRange> | null>(null);
  const linked = session.events.filter((event) => finding.event_ids.includes(event.id));
  useEffect(() => {
    if (!session.video_blob.size) return;
    const objectUrl = URL.createObjectURL(session.video_blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [session.video_blob]);
  useEffect(() => {
    clip.current = null;
    setPlayingClip(false);
    setError("");
    if (video.current) {
      video.current.pause();
      video.current.currentTime = Math.max(
        0,
        (finding.timestamp_ms + session.video_start_offset_ms) / 1000,
      );
    }
  }, [finding.id, finding.timestamp_ms, session.video_start_offset_ms]);
  const seek = (timestamp: number) => {
    if (!video.current) return;
    clip.current = null;
    setPlayingClip(false);
    video.current.currentTime = Math.max(0, (timestamp + session.video_start_offset_ms) / 1000);
  };
  const play = async () => {
    if (!video.current) return;
    setError("");
    const range = highlightRange(
      finding.timestamp_ms,
      session.duration_ms,
      session.video_start_offset_ms,
      Number.isFinite(video.current.duration) ? video.current.duration * 1000 : Infinity,
    );
    if (range.end_ms <= range.start_ms) {
      setError(
        "This timestamp is outside the playable recording. Open the full session to check calibration.",
      );
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
      setError("Playback could not start. Try the video controls or open the full recording.");
    }
  };
  return (
    <aside className="evidence-panel" aria-label="Finding evidence">
      <div className="evidence-panel-heading">
        <span>
          <Film size={16} />
          The evidence
        </span>
        <span className="status-badge">Internal recording</span>
      </div>
      {session.video_blob.size ? (
        <div className="evidence-video">
          <video
            ref={video}
            src={url || undefined}
            controls
            preload="metadata"
            aria-label="Recording supporting this finding"
            onLoadedMetadata={() => seek(finding.timestamp_ms)}
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
        <div className="info-note">No playable video is attached to this session.</div>
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
      {error && (
        <div className="error-note my-3" role="alert">
          {error}
        </div>
      )}
      <p className="evidence-caption">
        Original footage around the finding, clipped to recording boundaries. Calibration is shared
        with session replay.
      </p>
      {!finding.evidence_sources.includes("video") && (
        <div className="info-note mt-4">
          This finding came from events-only analysis. The model did not receive this video.
        </div>
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
        {!linked.length && (
          <p className="evidence-caption">
            No interaction events were cited. Review the visual evidence and timestamp directly.
          </p>
        )}
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
