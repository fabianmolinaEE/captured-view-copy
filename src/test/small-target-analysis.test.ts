// @vitest-environment node
import { describe, expect, it } from "vitest";
import { blindPayload } from "@/lib/research/aiReview";
import {
  closeUpRegion,
  closeUpTargets,
  repeatedTaps,
  sampleTimes,
  type Frame,
} from "@/lib/research/frameSampler";
import { analysisPrompt } from "@/lib/research/server/analysisPrompt.server";
import { analysisInput, frameLabel, geminiBody } from "@/lib/research/server/analysis.server";
import type { SessionEvent } from "@/lib/research/types";
import { makeSession } from "./research-fixtures";

const tap = (
  t_ms: number,
  hit: boolean,
  x = 0.5,
  y = 0.6,
  type = "tap",
  target_id = "checkout_region",
): SessionEvent => ({
  id: `${type}-${t_ms}`,
  session_id: "s",
  t_ms,
  type,
  screen: "item_details",
  target_id,
  x,
  y,
  metadata: { hit, coordinate_space: "checkout_normalized" },
});
const settings = { interval_seconds: 2, max_frames: 8, max_width: 960 };

describe("open-ended visual review prompt", () => {
  const prompt = analysisPrompt("video_frames_plus_events");
  it("opens broadly and adds a generic visual ergonomics lens", () => {
    expect(prompt).toMatch(
      /^You are a senior product designer and UX researcher\. Look at every screen/,
    );
    expect(prompt).toContain("Visual ergonomics lens");
    expect(prompt).toContain("44×44 pt (48×48 dp)");
    expect(prompt).toContain("Flag these even when no tap error occurred");
    expect(prompt).toContain("state its estimated size");
    expect(prompt).toContain("Review openly first");
    // The over-constraining gate on miss evidence is gone; honesty and count rules remain.
    expect(prompt).not.toContain("can support an interaction hypothesis only when");
    expect(prompt).toContain(
      "Aim for 2 to 3 distinct findings, ranked from most to least confident",
    );
    expect(prompt).toContain("fewer or no findings is valid");
  });
  it("names no planted scenario or specific control", () => {
    for (const mode of ["video_frames_plus_events", "events_only", "public_video"] as const)
      expect(analysisPrompt(mode)).not.toMatch(
        /missed_button|tiny[-_ ]target|small_button|checkout_button|Weekender|dead_click|text_clipping|missing_context/i,
      );
  });
  it("keeps events-only free of the visual lens", () => {
    const eventsOnly = analysisPrompt("events_only");
    expect(eventsOnly).not.toContain("Visual ergonomics lens");
    expect(eventsOnly).toContain("Do not claim to have seen color, layout");
  });
});

describe("frames near missed and repeated taps", () => {
  it("always samples just after each missed tap even with competing journey events", () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => ({
        ...tap(500 + i * 300, true, 0.5, 0.5, "screen_view"),
        id: `view-${i}`,
      })),
      tap(9000, false),
      tap(9000, false, 0.5, 0.6, "pointer_down"),
      tap(14_000, false, 0.62, 0.61),
    ];
    const times = sampleTimes(20_000, events, settings);
    expect(times).toContain(9200);
    expect(times).toContain(14_200);
  });
  it("treats rapid repeats on one target as signals, but not the paired tap/pointer_down", () => {
    const paired = [
      tap(4000, true, 0.5, 0.5, "tap", "pay"),
      tap(4000, true, 0.5, 0.5, "pointer_down", "pay"),
    ];
    expect(repeatedTaps(paired)).toEqual([]);
    const repeated = [...paired, tap(4600, true, 0.5, 0.5, "tap", "pay")];
    expect(repeatedTaps(repeated).map((e) => e.t_ms)).toEqual([4600]);
    expect(sampleTimes(20_000, repeated, { ...settings, max_frames: 4 })).toContain(4800);
  });
  it("chooses bounded, de-duplicated close-ups paired with sampled frames", () => {
    const events = [
      tap(9000, false),
      tap(9000, false, 0.5, 0.6, "pointer_down"),
      tap(9400, false, 0.51, 0.61), // same spot burst → one close-up
      tap(14_000, false, 0.2, 0.3),
      { ...tap(15_000, false, 300, 400), metadata: { hit: false } }, // legacy pixels: skipped
    ];
    const times = sampleTimes(20_000, events, settings);
    const spots = closeUpTargets(events, times);
    expect(spots).toEqual([
      { t_ms: 9200, x: 0.5, y: 0.6 },
      { t_ms: 14_200, x: 0.2, y: 0.3 },
    ]);
    for (const spot of spots) expect(times).toContain(spot.t_ms);
    const many = Array.from({ length: 10 }, (_, i) =>
      tap(1000 + i * 1800, false, (i % 5) / 5, 0.5),
    );
    expect(
      closeUpTargets(many, sampleTimes(20_000, many, { ...settings, max_frames: 40 })),
    ).toHaveLength(4);
  });
  it("keeps the close-up square and inside the crop", () => {
    // A phone crop of 730×1290 source pixels: a 219 px square around the touch.
    const area = closeUpRegion(0.98, 0.02, 730, 1290);
    expect(area.width).toBeCloseTo(0.3);
    expect(area.width * 730).toBeCloseTo(area.height * 1290);
    expect(area.x + area.width).toBeLessThanOrEqual(1);
    expect(area.y).toBe(0);
  });
});

describe("payload and provider request", () => {
  const image = "data:image/jpeg;base64,YQ==";
  const frames: Frame[] = [
    { t_ms: 1200, image, width: 730, height: 1290 },
    {
      t_ms: 1200,
      image,
      width: 768,
      height: 768,
      region: { x: 0.35, y: 0.5, width: 0.3, height: 0.17 },
    },
  ];
  it("labels close-ups numerically, requests high media resolution and still excludes scenario config", () => {
    const session = makeSession({
      scenario_config: ["SECRET_SCENARIO"],
      ground_truth_notes: "SECRET_TRUTH",
    } as never);
    const input = analysisInput.parse({
      ...blindPayload(session, frames),
      session_id: session.id,
      run_id: crypto.randomUUID(),
    });
    const body = geminiBody(input);
    const text = JSON.stringify(body);
    expect(text).not.toContain("SECRET_SCENARIO");
    expect(text).not.toContain("SECRET_TRUTH");
    expect(text).not.toContain("scenario_config");
    expect(body.generationConfig).toMatchObject({ mediaResolution: "MEDIA_RESOLUTION_HIGH" });
    expect(frameLabel(frames[0]!)).toBe("Video frame at 1200 ms (full app crop, 730×1290 px)");
    expect(frameLabel(frames[1]!)).toContain("Close-up at 1200 ms (768×768 px)");
    expect(frameLabel(frames[1]!)).toContain("x 0.35–0.65, y 0.5–0.67");
  });
  it("keeps events-only and public video at the provider default resolution", () => {
    const session = makeSession();
    const input = analysisInput.parse({
      ...blindPayload(session, [], "events_only"),
      session_id: session.id,
      run_id: crypto.randomUUID(),
    });
    expect(geminiBody(input).generationConfig).not.toHaveProperty("mediaResolution");
  });
  it("rejects more close-ups than the cap and free-text region fields", () => {
    const session = makeSession();
    const base = {
      ...blindPayload(session, frames),
      session_id: session.id,
      run_id: crypto.randomUUID(),
    };
    const closeUp = frames[1]!;
    expect(() =>
      analysisInput.parse({ ...base, frames: [frames[0], ...Array(5).fill(closeUp)] }),
    ).toThrow();
    expect(() =>
      analysisInput.parse({
        ...base,
        frames: [{ ...closeUp, region: { ...closeUp.region, note: "x" } }],
      }),
    ).toThrow();
  });
});
