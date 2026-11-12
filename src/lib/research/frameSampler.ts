import type { SessionEvent, SamplingSettings } from './types';
export interface Frame { t_ms: number; image: string; }
export function sampleTimes(durationMs: number, events: SessionEvent[], settings: SamplingSettings) {
  const signals = events.filter(e => ['network_timeout','retry','validation_rejected','modal_close_attempt','spinner_shown','spinner_hidden'].includes(e.type));
  const selected = new Set<number>();
  const clamp = (t: number) => Math.max(0, Math.min(durationMs - 100, Math.round(t)));
  // Reserve half the cap for evenly spaced coverage, then focus on observed signals.
  const step = Math.max(settings.interval_seconds * 1000, durationMs / Math.max(1, Math.floor(settings.max_frames / 2)));
  for (let t=0; t < durationMs && selected.size < Math.ceil(settings.max_frames/2); t+=step) selected.add(clamp(t));
  for (const e of signals) for (const delta of [-500, 500]) if (selected.size < settings.max_frames) selected.add(clamp(e.t_ms + delta));
  return [...selected].sort((a,b) => a-b);
}
export async function extractFrames(blob: Blob, durationMs: number, events: SessionEvent[], settings: SamplingSettings): Promise<Frame[]> {
  const url = URL.createObjectURL(blob); const video = document.createElement('video'); video.muted = true; video.preload = 'auto';
  try {
    await new Promise<void>((resolve,reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('The recorded video could not be decoded.')); video.src = url; });
    const canvas = document.createElement('canvas'); const factor = Math.min(1, settings.max_width / video.videoWidth); canvas.width = Math.round(video.videoWidth*factor); canvas.height = Math.round(video.videoHeight*factor);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Frame extraction is unavailable.');
    const frames: Frame[] = [];
    for (const t_ms of sampleTimes(durationMs, events, settings)) {
      await new Promise<void>((resolve,reject) => { const timeout = setTimeout(() => reject(new Error('Video seeking timed out.')),10000); video.onseeked = () => { clearTimeout(timeout); resolve(); }; video.currentTime = Math.max(.001, t_ms/1000); });
      context.drawImage(video,0,0,canvas.width,canvas.height); frames.push({ t_ms, image: canvas.toDataURL('image/jpeg',.75) });
    }
    return frames;
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
