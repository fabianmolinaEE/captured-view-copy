import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import { analyzeSession } from "@/lib/research/apiClient";
const mocked = vi.hoisted(() => ({ extractFrames: vi.fn(), getSampling: vi.fn() }));
vi.mock("@/lib/research/frameSampler", () => ({ extractFrames: mocked.extractFrames }));
vi.mock("@/lib/research/sessionStorage", () => ({ getSampling: mocked.getSampling }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sessionStorage.clear();
});
describe("public video client transport", () => {
  it("uses the existing authenticated API without extracting nonexistent local video frames", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ run: {}, findings: [] }));
    vi.stubGlobal("fetch", fetcher);
    const session = createPublicSession(uberEatsCandidates[0], 120000, 10000, 60000);
    await analyzeSession(session, "public_video", vi.fn());
    expect(mocked.extractFrames).not.toHaveBeenCalled();
    expect(mocked.getSampling).not.toHaveBeenCalled();
    const payload = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(payload.mode).toBe("public_video");
    expect(payload.events).toEqual([]);
    expect(payload).not.toHaveProperty("frames");
    expect(payload.youtube_video.start_ms).toBe(10000);
  });
  it("rejects the empty events baseline on a public reference", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      analyzeSession(
        createPublicSession(uberEatsCandidates[0], 120000, 0, 60000),
        "events_only",
        vi.fn(),
      ),
    ).rejects.toThrow("video analysis");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
