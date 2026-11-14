import { useEffect, useState } from "react";

/** Return a four-second media range where available, using session replay's calibration. */
export function highlightRange(
  timestampMs: number,
  durationMs: number,
  offsetMs = 0,
  mediaDurationMs = Infinity,
) {
  const total = Math.max(
    0,
    Math.min(
      durationMs,
      Number.isFinite(mediaDurationMs) ? mediaDurationMs - offsetMs : durationMs,
    ),
  );
  const length = Math.min(4000, total);
  const start = Math.max(0, Math.min(Math.max(0, timestampMs) - 2000, total - length));
  const end = start + length;
  return {
    start_ms: Math.max(0, start + offsetMs),
    end_ms: Math.max(0, Math.min(mediaDurationMs, end + offsetMs)),
  };
}

/**
 * Generated frame thumbnails, keyed by a stable recording identity then media time (ms).
 * IndexedDB returns a new Blob object on every read, so the key is a string (session id plus the
 * blob's size and type) rather than the Blob itself; reloading sessions then reuses earlier grabs
 * instead of decoding every recording again. Bounded so long sessions do not grow it forever.
 */
const frameCache = new Map<string, Promise<string | null>>();
const MAX_CACHED_FRAMES = 240;
const frameKey = (blob: Blob, recordingKey: string | undefined, ms: number) =>
  `${recordingKey ?? ""}|${blob.size}|${blob.type}|${ms}`;
/** Decoding several recordings at once is expensive, so frame grabs run two at a time. */
const MAX_PARALLEL_FRAMES = 2;
let activeFrames = 0;
const frameQueue: (() => void)[] = [];
const takeSlot = () =>
  new Promise<void>((resolve) => {
    if (activeFrames < MAX_PARALLEL_FRAMES) {
      activeFrames += 1;
      resolve();
    } else frameQueue.push(resolve);
  });
const releaseSlot = () => {
  const next = frameQueue.shift();
  if (next) next();
  else activeFrames = Math.max(0, activeFrames - 1);
};

/**
 * Paints the frame of a locally saved recording at `mediaMs` into a small JPEG data URL, using an
 * offscreen muted <video>: load, seek, wait for `seeked`, draw to a canvas. The temporary object
 * URL is always revoked. Resolves null (never rejects) without a DOM, for an empty blob, when the
 * browser cannot decode the file, or after `timeoutMs`; callers then show a placeholder.
 * Results are cached per blob and time, so re-renders do not decode the recording again.
 */
export function captureVideoFrame(
  blob: Blob,
  mediaMs: number,
  {
    maxWidth = 320,
    timeoutMs = 8000,
    recordingKey,
  }: {
    maxWidth?: number;
    timeoutMs?: number;
    /** Stable identity of the recording (the session id), so re-read Blobs share the cache. */
    recordingKey?: string | undefined;
  } = {},
): Promise<string | null> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function" || !blob.size)
    return Promise.resolve(null);
  const ms = Math.max(0, Math.round(mediaMs));
  const key = frameKey(blob, recordingKey, ms);
  const cached = frameCache.get(key);
  if (cached) return cached;
  const result = takeSlot().then(() =>
    grabFrame(blob, ms / 1000, maxWidth, timeoutMs).finally(releaseSlot),
  );
  frameCache.set(key, result);
  if (frameCache.size > MAX_CACHED_FRAMES) {
    const oldest = frameCache.keys().next().value;
    if (oldest !== undefined) frameCache.delete(oldest);
  }
  // A failed grab is not cached, so a later mount can retry.
  void result.then((url) => {
    if (!url && frameCache.get(key) === result) frameCache.delete(key);
  });
  return result;
}

/**
 * True when every sampled pixel is near black: what an undecoded <video> paints. Such a canvas is
 * not a real frame, so the caller shows the placeholder instead of a black thumbnail.
 */
function looksBlank(context: CanvasRenderingContext2D, width: number, height: number) {
  if (typeof context.getImageData !== "function") return false;
  const { data } = context.getImageData(0, 0, width, height);
  const pixels = data.length / 4;
  const step = Math.max(1, Math.floor(pixels / 64));
  for (let i = 0; i < pixels; i += step) {
    const at = i * 4;
    if (Math.max(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0) > 8) return false;
  }
  return true;
}

function grabFrame(blob: Blob, seconds: number, maxWidth: number, timeoutMs: number) {
  return new Promise<string | null>((resolve) => {
    const video = document.createElement("video");
    const source = URL.createObjectURL(blob);
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        /* Detached element; nothing left to release. */
      }
      URL.revokeObjectURL(source);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const paint = () => {
      if (done) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return finish(null);
      const scale = Math.min(1, maxWidth / width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      try {
        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (looksBlank(context, canvas.width, canvas.height)) return finish(null);
        finish(canvas.toDataURL("image/jpeg", 0.78));
      } catch {
        finish(null);
      }
    };
    // `seeked` can fire before the frame at the new position is decoded (Safari/WebKit, detached
    // elements, WebM without cues); drawing then paints nothing. Wait for decoded data first.
    const HAVE_CURRENT_DATA = 2;
    let waiting = false;
    const draw = () => {
      if (done) return;
      if (video.readyState >= HAVE_CURRENT_DATA) return paint();
      if (waiting) return;
      waiting = true;
      const ready = () => {
        if (video.readyState >= HAVE_CURRENT_DATA) paint();
      };
      video.addEventListener("canplay", ready, { once: true });
      if (typeof video.requestVideoFrameCallback === "function")
        video.requestVideoFrameCallback(ready);
    };
    let target = seconds;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("error", () => finish(null));
    video.addEventListener("loadedmetadata", () => {
      // Recordings without repaired WebM duration report Infinity; seek anyway and let the
      // browser clamp. Otherwise stay just inside the end so a frame exists.
      if (Number.isFinite(video.duration) && video.duration > 0)
        target = Math.min(target, Math.max(0, video.duration - 0.05));
    });
    video.addEventListener("loadeddata", () => {
      // A seek to the current position may never fire `seeked`, so draw directly.
      if (Math.abs(video.currentTime - target) < 0.01) draw();
      else video.currentTime = target;
    });
    video.addEventListener("seeked", draw);
    video.src = source;
  });
}

/**
 * A real frame of a locally saved recording at `mediaMs` (media time, i.e. timeline ms plus
 * video_start_offset_ms), as a data URL; null while loading, without a blob, or on failure.
 * SSR-safe: the frame is only grabbed in an effect, in the browser.
 */
export function useFrameThumbnail(
  blob: Blob | undefined,
  mediaMs: number,
  /** Stable recording identity (the session id); keeps the frame across re-read Blobs. */
  recordingKey?: string,
) {
  const [frame, setFrame] = useState<{ key: string; url: string | null } | null>(null);
  const key = blob?.size ? frameKey(blob, recordingKey, Math.max(0, Math.round(mediaMs))) : null;
  useEffect(() => {
    if (!blob?.size || !key || !Number.isFinite(mediaMs)) return;
    let alive = true;
    void captureVideoFrame(blob, mediaMs, { recordingKey }).then((url) => {
      if (alive) setFrame({ key, url });
    });
    return () => {
      alive = false;
    };
    // `key` changes with the recording identity and time; a re-read Blob with the same identity
    // keeps the shown frame and hits the cache instead of flashing the placeholder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return frame && key && frame.key === key ? frame.url : null;
}
