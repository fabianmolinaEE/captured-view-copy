import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { youtubePlaybackError, youtubeThumbnailUrl, youtubeURL } from "@/lib/research/publicVideo";
import { Button } from "@/components/ui/button";

type Player = {
  getDuration(): number;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  /** -1 unstarted, 5 cued (poster still showing); optional so older stubs keep working. */
  getPlayerState?(): number;
};
/** Seeking a player that has not started makes YouTube swap its poster for a (often black) frame. */
const showingPoster = (player: Player) => {
  try {
    const state = player.getPlayerState?.();
    return state === -1 || state === 5;
  } catch {
    return false;
  }
};
type API = {
  Player: new (
    element: HTMLElement,
    options: { events: { onReady: () => void; onError: (event: { data: number }) => void } },
  ) => Player;
};
type YouTubeWindow = Window & { YT?: API; onYouTubeIframeAPIReady?: (() => void) | undefined };
const API_SRC = "https://www.youtube.com/iframe_api";
let pending: Promise<API> | undefined;
/**
 * Loads the official IFrame Player API once. Another script's onYouTubeIframeAPIReady is chained,
 * never replaced, and is restored if loading fails.
 */
function loadAPI() {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (pending) return pending;
  pending = new Promise<API>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const previous = host.onYouTubeIframeAPIReady;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!existing) script.remove();
      if (host.onYouTubeIframeAPIReady === ready) host.onYouTubeIframeAPIReady = previous;
      reject(
        new Error(
          "Timeline controls could not connect. You can still use the video player's controls.",
        ),
      );
    };
    const ready = () => {
      try {
        previous?.();
      } finally {
        if (!settled && host.YT?.Player) {
          settled = true;
          clearTimeout(timeout);
          resolve(host.YT);
        } else fail();
      }
    };
    const timeout = setTimeout(fail, 20000);
    host.onYouTubeIframeAPIReady = ready;
    script.addEventListener("error", fail);
    if (!existing) {
      script.src = API_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
export function PublicVideoPlayer({
  videoId,
  startMs = 0,
  endMs,
  clipEndMs,
  playToken = 0,
  title = "Session recording",
  onDuration,
  onTimeUpdate,
  onPlaybackError,
}: {
  videoId: string;
  /** Seek target (original-video ms). Changing it, or playToken, seeks again. */
  startMs?: number;
  /** Playback pauses once the position reaches this point (e.g. the end of a highlight). */
  endMs?: number | undefined;
  /** Fixed end of the saved clip; sent once as the embed's `end` parameter. */
  clipEndMs?: number | undefined;
  /** Increment to seek to startMs and play, even if startMs is unchanged. */
  playToken?: number;
  title?: string;
  onDuration?: (ms: number) => void;
  onTimeUpdate?: (ms: number) => void;
  /** Called with the player's error code when the embed cannot play. */
  onPlaybackError?: (code: number) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  /** Set only once the IFrame API reports ready; before that, seek/play methods may not exist. */
  const player = useRef<Player | null>(null);
  /** The highlight end pauses playback once per requested play, then the viewer is free to continue. */
  const stopArmed = useRef(false);
  const latest = useRef({
    startMs,
    endMs,
    clipEndMs,
    playToken,
    title,
    onDuration,
    onTimeUpdate,
    onPlaybackError,
  });
  latest.current = {
    startMs,
    endMs,
    clipEndMs,
    playToken,
    title,
    onDuration,
    onTimeUpdate,
    onPlaybackError,
  };
  const [error, setError] = useState("");
  const [controlError, setControlError] = useState("");
  const [retry, setRetry] = useState(0);
  const [position, setPosition] = useState(startMs);
  useEffect(() => {
    const container = mount.current;
    if (!container || !/^[\w-]{11}$/.test(videoId)) return;
    let alive = true;
    let owned: Player | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let duration = 0;
    let lastPosition = -1;
    setError("");
    setControlError("");
    // The embed is visible independently of the JS API. Attributes are set BEFORE loading.
    const frame = document.createElement("iframe");
    const params = new URLSearchParams({
      enablejsapi: "1",
      origin: window.location.origin,
      playsinline: "1",
      rel: "0",
      start: String(Math.max(0, Math.floor(latest.current.startMs / 1000))),
    });
    const clipEnd = latest.current.clipEndMs;
    if (clipEnd !== undefined && Number.isFinite(clipEnd) && clipEnd > 0)
      params.set("end", String(Math.ceil(clipEnd / 1000)));
    frame.title = latest.current.title;
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    frame.setAttribute("allowfullscreen", "");
    frame.width = "100%";
    frame.height = "100%";
    frame.src = `https://www.youtube.com/embed/${videoId}?${params}`;
    container.appendChild(frame);
    void loadAPI()
      .then((api) => {
        if (!alive) return;
        owned = new api.Player(frame, {
          events: {
            onReady: () => {
              if (!alive || !owned) return;
              player.current = owned;
              // Without a play request, leave the cued embed alone: its `start` parameter already
              // points at startMs, and seekTo + pauseVideo here would replace YouTube's poster
              // with a black, still-buffering frame.
              if (latest.current.playToken) {
                owned.seekTo(latest.current.startMs / 1000, true);
                stopArmed.current = true;
                owned.playVideo();
              }
              poll = setInterval(() => {
                if (!alive || !owned) return;
                const seconds = owned.getDuration();
                if (
                  Number.isFinite(seconds) &&
                  seconds > 0 &&
                  Math.round(seconds * 1000) !== duration
                ) {
                  duration = Math.round(seconds * 1000);
                  latest.current.onDuration?.(duration);
                }
                const now = Math.round(owned.getCurrentTime() * 1000);
                if (Number.isFinite(now) && now !== lastPosition) {
                  lastPosition = now;
                  setPosition(now);
                  latest.current.onTimeUpdate?.(now);
                }
                if (
                  stopArmed.current &&
                  latest.current.endMs !== undefined &&
                  now >= latest.current.endMs
                ) {
                  stopArmed.current = false;
                  owned.pauseVideo();
                }
              }, 300);
            },
            onError: (event) => {
              if (!alive) return;
              clearInterval(poll);
              setError(youtubePlaybackError(event.data));
              latest.current.onPlaybackError?.(event.data);
            },
          },
        });
      })
      .catch((reason: unknown) => {
        if (alive)
          setControlError(
            reason instanceof Error ? reason.message : "Use the video player's controls.",
          );
      });
    return () => {
      alive = false;
      clearInterval(poll);
      try {
        owned?.destroy();
      } catch {
        /* The iframe is removed below either way. */
      }
      if (player.current === owned) player.current = null;
      container.replaceChildren();
    };
  }, [videoId, retry]);
  useEffect(() => {
    const ready = player.current;
    // Before onReady, the ready handler applies the latest start/play request itself.
    if (!ready) return;
    try {
      if (playToken) {
        ready.seekTo(startMs / 1000, true);
        stopArmed.current = true;
        ready.playVideo();
      } else if (!showingPoster(ready)) {
        ready.seekTo(startMs / 1000, true);
        ready.pauseVideo();
      }
    } catch {
      /* A player torn down mid-call; the iframe's own controls still work. */
    }
  }, [startMs, playToken]);
  const poster = youtubeThumbnailUrl(videoId, "hqdefault");
  const watchUrl = `${youtubeURL(videoId)}&t=${Math.max(0, Math.floor(position / 1000))}s`;
  return (
    <div className="public-player-wrap">
      <div
        className="public-player"
        ref={mount}
        aria-label="Session video"
        // YouTube's public poster shows behind the embed while it loads, instead of a black box.
        style={
          poster ? { background: `#0e0b17 center / cover no-repeat url("${poster}")` } : undefined
        }
      />
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      {!error && controlError && <p className="text-xs text-muted-foreground">{controlError}</p>}
      {(error || controlError) && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
            Reload player
          </Button>
          {error && (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            >
              Watch on YouTube <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
