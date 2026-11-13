import type { SessionEvent, SamplingSettings, Session } from "./types";
export interface Frame {
  t_ms: number;
  image: string;
}
export function sampleTimes(
  durationMs: number,
  events: SessionEvent[],
  settings: SamplingSettings,
  validFromMs = 0,
) {
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
  const interaction = events.filter(
    (e) =>
      ((e.type === "tap" || e.type === "pointer_down") && e.metadata?.hit === false) ||
      e.type === "backtrack",
  );
  const system = events.filter((e) =>
    /timeout|retry|validation_rejected|modal_close|spinner/.test(e.type),
  );
  const signals = [...interaction, ...system];
  // Round-robin signals so a single burst does not consume the whole budget.
  for (const delta of [200, -400, 600]) for (const e of signals) add(e.t_ms + delta);
  for (let t = 0; t <= last && selected.size < cap; t += interval) add(t);
  return [...selected].sort((a, b) => a - b);
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
      frames.push({ t_ms, image: canvas.toDataURL("image/jpeg", 0.75) });
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
