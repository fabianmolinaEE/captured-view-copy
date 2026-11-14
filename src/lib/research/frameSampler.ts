import type { SessionEvent, SamplingSettings, Session } from "./types";
export interface Frame {
  t_ms: number;
  image: string;
  /** Encoded image size in pixels, so the model can relate controls to the app crop. */
  width?: number | undefined;
  height?: number | undefined;
  /**
   * Present only on a close-up: the enlarged area as fractions of the app crop. The close-up is
   * taken at the same timestamp as a full sampled frame.
   */
  region?: { x: number; y: number; width: number; height: number } | undefined;
}
/** Bounded so close-ups stay a small fraction of the request. */
export const MAX_CLOSE_UPS = 4;
const isTap = (e: SessionEvent) => e.type === "tap" || e.type === "pointer_down";
const isMiss = (e: SessionEvent) => isTap(e) && e.metadata?.["hit"] === false;
/**
 * Rapid repeats on the same target (a second distinct touch within a second). The controlled app
 * logs `tap` and `pointer_down` for one touch at the same instant, so near-simultaneous events
 * are one touch, not a repeat.
 */
export function repeatedTaps(events: SessionEvent[]): SessionEvent[] {
  const taps = events.filter(isTap).sort((a, b) => a.t_ms - b.t_ms);
  const repeats: SessionEvent[] = [];
  for (let i = 1; i < taps.length; i++) {
    const current = taps[i]!;
    const earlier = taps
      .slice(0, i)
      .reverse()
      .find((e) => e.target_id === current.target_id && current.t_ms - e.t_ms > 50);
    if (current.target_id && earlier && current.t_ms - earlier.t_ms <= 1000) repeats.push(current);
  }
  return repeats;
}
/** Missed, repeated and backtrack interactions, which always get a nearby frame first. */
export function interactionSignals(events: SessionEvent[]): SessionEvent[] {
  const repeats = new Set(repeatedTaps(events));
  return events.filter(
    (e) =>
      isMiss(e) ||
      repeats.has(e) ||
      e.type === "backtrack" ||
      /dead_click|rage_click|repeated_tap/.test(e.type),
  );
}
export function sampleTimes(
  durationMs: number,
  events: SessionEvent[],
  settings: SamplingSettings,
  validFromMs = 0,
): number[] {
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(validFromMs) ||
    validFromMs >= durationMs
  )
    return [];
  if (validFromMs > 0) {
    const start = Math.ceil(validFromMs);
    return sampleTimes(
      durationMs - start,
      events.filter((e) => e.t_ms >= start).map((e) => ({ ...e, t_ms: e.t_ms - start })),
      settings,
    ).map((t) => t + start);
  }
  const cap = Math.min(40, Math.max(1, Math.floor(settings.max_frames) || 24));
  const interval = Math.max(250, settings.interval_seconds * 1000 || 2000);
  const last = Math.max(0, Math.floor(durationMs - Math.min(100, durationMs / 2)));
  const selected = new Set<number>();
  const add = (t: number) => {
    if (selected.size < cap) selected.add(Math.round(Math.max(0, Math.min(last, t))));
  };
  const coverage = Math.ceil(cap / 2);
  const step = Math.max(interval, last / Math.max(1, coverage - 1));
  for (let t = 0; t <= last && selected.size < coverage; t += step) add(t);
  add(last);
  // Interaction friction (missed taps, backtracking) is listed first so short sessions with a
  // fast spinner don't spend the whole signal budget on loading frames.
  const interaction = interactionSignals(events);
  const system = events.filter((e) =>
    /timeout|retry|validation_rejected|modal_close|spinner/.test(e.type),
  );
  const journey = events.filter((event) =>
    /^(screen_view|scroll|selection_change|button_click|input_focus|submit_attempt)$/.test(
      event.type,
    ),
  );
  // Interleave normal journey context with error signals instead of spending the budget only on defects.
  const context = Array.from({ length: Math.max(journey.length, system.length) }, (_, index) => [
    journey[index],
    system[index],
  ])
    .flat()
    .filter((event): event is SessionEvent => !!event);
  const signals = [...interaction, ...context];
  // Round-robin signals so a single burst does not consume the whole budget.
  for (const delta of [200, -400, 600]) for (const e of signals) add(e.t_ms + delta);
  for (let t = 0; t <= last && selected.size < cap; t += interval) add(t);
  return [...selected].sort((a, b) => a - b);
}
export interface CloseUpTarget {
  /** A timestamp already selected for a full frame. */
  t_ms: number;
  /** Touch point as fractions of the app crop. */
  x: number;
  y: number;
}
/**
 * Missed and repeated touch points that deserve an enlarged view, paired with the nearest full
 * frame (preferring just after the touch). Only crop-normalized coordinates qualify; legacy
 * viewport-pixel coordinates cannot be mapped onto the crop.
 */
export function closeUpTargets(
  events: SessionEvent[],
  times: number[],
  max = MAX_CLOSE_UPS,
): CloseUpTarget[] {
  const chosen: (CloseUpTarget & { at: number })[] = [];
  for (const e of interactionSignals(events)) {
    if (chosen.length >= max) break;
    if (!isTap(e) || e.metadata?.["coordinate_space"] !== "checkout_normalized") continue;
    const { x, y } = e;
    if (x === undefined || y === undefined || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) continue;
    const near = times
      .filter((t) => t >= e.t_ms - 500 && t <= e.t_ms + 1000)
      .sort((a, b) => Math.abs(a - (e.t_ms + 200)) - Math.abs(b - (e.t_ms + 200)))[0];
    if (near === undefined) continue;
    // One close-up per spot: a burst of touches on the same control is shown once.
    if (chosen.some((c) => Math.abs(c.at - e.t_ms) < 1500 && Math.hypot(c.x - x, c.y - y) < 0.08))
      continue;
    chosen.push({ t_ms: near, x, y, at: e.t_ms });
  }
  return chosen.map(({ t_ms, x, y }) => ({ t_ms, x, y }));
}
/** Square close-up side as a fraction of the crop width, and its encoded size bound. */
const CLOSE_UP_FRACTION = 0.3;
const CLOSE_UP_MAX_PX = 768;
const CLOSE_UP_MAX_ZOOM = 4;
/** Close-up area in normalized crop coordinates, clamped to stay inside the crop. */
export function closeUpRegion(x: number, y: number, cropWidthPx: number, cropHeightPx: number) {
  const side = Math.min(cropWidthPx, cropHeightPx, cropWidthPx * CLOSE_UP_FRACTION);
  const width = side / cropWidthPx,
    height = side / cropHeightPx;
  const clamp = (v: number, size: number) => Math.min(1 - size, Math.max(0, v - size / 2));
  return { x: clamp(x, width), y: clamp(y, height), width, height };
}
export async function extractFrames(
  blob: Blob,
  durationMs: number,
  events: SessionEvent[],
  settings: SamplingSettings,
  offsetMs = 0,
  region?: Session["capture_region"],
  validFromMs = 0,
): Promise<Frame[]> {
  const times = sampleTimes(durationMs, events, settings, validFromMs);
  if (!times.length)
    throw new Error(
      "No stable checkout footage remains after the capture size changed. Record again and wait a few seconds before stopping.",
    );
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  const wait = (event: "loadeddata" | "seeked", action: () => void) =>
    new Promise<void>((resolve, reject) => {
      const clean = () => {
        clearTimeout(timeout);
        video.removeEventListener(event, done);
        video.removeEventListener("error", fail);
      };
      const done = () => {
        clean();
        resolve();
      };
      const fail = () => {
        clean();
        reject(
          new Error(
            "The saved video could not be decoded or sought. Download it for manual review.",
          ),
        );
      };
      const timeout = setTimeout(fail, 15000);
      video.addEventListener(event, done, { once: true });
      video.addEventListener("error", fail, { once: true });
      action();
    });
  try {
    await wait("loadeddata", () => {
      video.src = url;
    });
    const crop = region ?? { x: 0, y: 0, width: 1, height: 1 };
    const sx = crop.x * video.videoWidth,
      sy = crop.y * video.videoHeight;
    const sw = crop.width * video.videoWidth,
      sh = crop.height * video.videoHeight;
    if (!sw || !sh) throw new Error("The recording has no decodable video dimensions.");
    const canvas = document.createElement("canvas");
    const factor = Math.min(1, Math.min(960, settings.max_width) / sw);
    canvas.width = Math.max(1, Math.round(sw * factor));
    canvas.height = Math.max(1, Math.round(sh * factor));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Frame extraction is unavailable.");
    // Close-ups need crop-normalized touch points, which only exist with a recorded crop.
    const closeUps = region ? closeUpTargets(events, times) : [];
    const zoom = document.createElement("canvas");
    const zoomContext = closeUps.length ? zoom.getContext("2d") : null;
    const frames: Frame[] = [];
    for (const t_ms of times) {
      const end = Number.isFinite(video.duration)
        ? Math.max(0, video.duration - 0.01)
        : (durationMs + offsetMs) / 1000;
      const target = Math.min(end, Math.max(0.001, (t_ms + offsetMs) / 1000));
      if (Math.abs(video.currentTime - target) > 0.0001)
        await wait("seeked", () => {
          video.currentTime = target;
        });
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      frames.push({
        t_ms,
        image: canvas.toDataURL("image/jpeg", 0.82),
        width: canvas.width,
        height: canvas.height,
      });
      if (!zoomContext) continue;
      for (const spot of closeUps.filter((c) => c.t_ms === t_ms)) {
        // Read from the source video pixels, not the downscaled frame, so small text stays legible.
        const area = closeUpRegion(spot.x, spot.y, sw, sh);
        const side = area.width * sw;
        const scale = Math.min(CLOSE_UP_MAX_ZOOM, CLOSE_UP_MAX_PX / side);
        zoom.width = zoom.height = Math.max(1, Math.round(side * scale));
        zoomContext.imageSmoothingQuality = "high";
        zoomContext.drawImage(
          video,
          sx + area.x * sw,
          sy + area.y * sh,
          side,
          area.height * sh,
          0,
          0,
          zoom.width,
          zoom.height,
        );
        frames.push({
          t_ms,
          image: zoom.toDataURL("image/jpeg", 0.9),
          width: zoom.width,
          height: zoom.height,
          region: area,
        });
      }
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
