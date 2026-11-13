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
