// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createPublicSession,
  uberEatsCandidates,
  youtubeId,
  validatePublicClip,
} from "@/lib/research/publicVideo";
import { blindPayload } from "@/lib/research/aiReview";
import { analysisInput, analyze, geminiBody } from "@/lib/research/server/analysis.server";
import { aggregateInsights, latestFindings } from "@/lib/research/insights";
import { reviewFinding } from "@/lib/research/review";
import { makeFinding, makeRun, modelOutput } from "./research-fixtures";

function input() {
  const session = createPublicSession(uberEatsCandidates[0], 120000, 30000, 90000);
  return {
    session,
    value: analysisInput.parse({
      session_id: session.id,
      run_id: crypto.randomUUID(),
      ...blindPayload(session, [], "public_video"),
    }),
  };
}
function response(patch: Record<string, unknown> = {}) {
  return Response.json({
    modelVersion: "test-video-model",
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            {
              text: JSON.stringify(
                modelOutput({
                  timestamp_ms: 35000,
                  end_timestamp_ms: 36000,
                  event_ids: [],
                  evidence_sources: ["video"],
                  ...patch,
                }),
              ),
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 130 },
  });
}
describe("public video evidence boundary", () => {
  it("creates a genuine reference with no copied video, planted issues or invented events", () => {
    const { session } = input();
    expect(session.source_app).toBe("Uber Eats");
    expect(session.video_blob.size).toBe(0);
    expect(session.events).toEqual([]);
    expect(session.issues).toEqual([]);
    expect(session.findings).toEqual([]);
    expect(session.scenario_config).toEqual([]);
    expect(new Set(uberEatsCandidates.map((candidate) => candidate.id)).size).toBe(5);
  });
  it("requires bounded in-video segments and canonical HTTPS YouTube URLs", () => {
    for (const values of [
      [1000, 0, 2000],
      [1000, 1000, 1000],
      [600000, 0, 300001],
      [NaN, 0, 1000],
      [1000, -1, 500],
    ])
      expect(() => validatePublicClip(values[0]!, values[1]!, values[2]!)).toThrow();
    expect(youtubeId("https://www.youtube.com/watch?v=EFCmkDTBYck")).toBe("EFCmkDTBYck");
    for (const url of [
      "http://www.youtube.com/watch?v=EFCmkDTBYck",
      "https://www.youtube.com.evil.test/watch?v=EFCmkDTBYck",
      "https://localhost/private",
      "https://www.youtube.com/watch?v=EFCmkDTBYck&token=secret",
    ])
      expect(youtubeId(url)).toBeNull();
  });
  it("keeps creator notes and researcher configuration out of provider input", () => {
    const { session } = input();
    session.public_video!.context = "SECRET_CONTEXT";
    session.title = "SECRET_TITLE";
    const payload = blindPayload(session, [{ t_ms: 0, image: "SECRET_FRAME" }], "public_video");
    expect(payload).not.toHaveProperty("frames");
    expect(payload.events).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain("SECRET_");
  });
  it("rejects mixed modes and fabricated internal event streams", () => {
    const { value } = input();
    expect(() =>
      analysisInput.parse({
        ...value,
        events: [{ id: "invented", type: "tap", screen: "menu", t_ms: 35000 }],
      }),
    ).toThrow();
    expect(() => analysisInput.parse({ ...value, frames: [] })).toThrow();
    expect(() => analysisInput.parse({ ...value, mode: "events_only" })).toThrow();
    expect(() =>
      analysisInput.parse({ ...value, youtube_video: { ...value.youtube_video, end_ms: 999999 } }),
    ).toThrow();
  });
  it("sends bounded native video input and retains provider-reported provenance", async () => {
    const { value } = input();
    const body = geminiBody(value);
    expect(body.contents[0]!.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileData: { fileUri: value.youtube_video!.url, mimeType: "video/mp4" },
          media_processing: "AGENTIC",
        }),
        { text: expect.stringContaining("segment from 00:30 to 01:30") },
      ]),
    );
    // Clipping/fps are static-only, so agentic requests must not send videoMetadata.
    expect(JSON.stringify(body)).not.toContain("videoMetadata");
    const fetcher = vi.fn().mockResolvedValue(response());
    const result = await analyze(value, "test-key", "test-model", fetcher);
    expect(result.run.mode).toBe("public_video");
    expect(result.run.source_clip).toEqual(value.youtube_video);
    expect(result.run.frame_count).toBeUndefined();
    expect(result.run.usage?.total_tokens).toBe(130);
    expect(result.findings[0]?.timestamp_ms).toBe(35000);
    expect(result.findings[0]?.review_status).toBe("pending");
  });
  it("rejects out-of-segment findings and invented event citations without shifting timestamps", async () => {
    const { value } = input();
    for (const patch of [
      { timestamp_ms: 5000, end_timestamp_ms: 6000 },
      { timestamp_ms: 95000, end_timestamp_ms: 96000 },
      { event_ids: ["invented"] },
      { visual_evidence: "" },
    ])
      await expect(
        analyze(value, "test-key", "test-model", vi.fn().mockResolvedValue(response(patch))),
      ).rejects.toThrow();
  });
  it("shows actual public-video findings but excludes walkthroughs from customer frequency", () => {
    const { session } = input();
    const run = makeRun({ mode: "public_video" });
    session.runs = [run];
    session.findings = [
      makeFinding({ analysis_run_id: run.id, event_ids: [], evidence_sources: ["video"] }),
    ];
    expect(latestFindings(session)).toHaveLength(1);
    expect(aggregateInsights([session])).toEqual([]);
    expect(
      reviewFinding(session, session.findings[0]!.id, { review_status: "accepted" }).status,
    ).toBe("reviewed");
  });
});
