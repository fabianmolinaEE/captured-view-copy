import { describe, expect, it } from "vitest";
import { sampleTimes } from "@/lib/research/frameSampler";
import type { SessionEvent } from "@/lib/research/types";

const event = (t_ms: number, type: string, metadata?: SessionEvent["metadata"]): SessionEvent => ({
  id: `${type}-${t_ms}`,
  session_id: "s",
  t_ms,
  type,
  screen: "item_details",
  metadata,
});

describe("signal-adjacent frame sampling", () => {
  it("samples around missed taps even when spinner signals compete for a small budget", () => {
    const events = [
      event(5000, "spinner_shown"),
      event(5400, "spinner_hidden"),
      event(12_000, "tap", { hit: false }),
      event(12_500, "tap", { hit: true }),
    ];
    const times = sampleTimes(20_000, events, {
      interval_seconds: 2,
      max_frames: 8,
      max_width: 960,
    });
    expect(times.some((t) => t >= 11_600 && t <= 12_600)).toBe(true);
    expect(times).toContain(12_200);
  });
  it("does not add frames for taps that hit their target", () => {
    const hits = sampleTimes(20_000, [event(12_000, "tap", { hit: true })], {
      interval_seconds: 20,
      max_frames: 4,
      max_width: 960,
    });
    expect(hits).not.toContain(12_200);
  });
});
