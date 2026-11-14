import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachOriginalVideo } from "@/lib/research/videoAttachment";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import { makeRun } from "./research-fixtures";

let video: HTMLVideoElement;
const revoke = vi.fn();
beforeEach(() => {
  video = document.createElement("video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name, options) =>
    name === "video" ? video : create(name, options),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL() {
        return "blob:original";
      }
      static override revokeObjectURL = revoke;
    },
  );
  revoke.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("original recording attachment", () => {
  it("preserves source, timeline and analysis when attaching the original file", async () => {
    const session = createPublicSession(uberEatsCandidates[0], 120000, 30000, 90000);
    session.runs = [makeRun({ mode: "public_video" })];
    const file = new File(["original recording"], "original.mp4", { type: "video/mp4" });
    const pending = attachOriginalVideo(session, file);
    video.dispatchEvent(new Event("loadedmetadata"));
    const attached = await pending;
    expect(attached.video_blob).toBe(file);
    expect(attached.public_video).toEqual(session.public_video);
    expect(attached.runs).toEqual(session.runs);
    expect(attached.duration_ms).toBe(120000);
    expect(attached.id).toBe(session.id);
    expect(session.video_blob.size).toBe(0);
    expect(revoke).toHaveBeenCalledWith("blob:original");
  });
  it("rejects a different timeline and releases its object URL", async () => {
    const session = createPublicSession(uberEatsCandidates[0], 90000, 0, 60000);
    const pending = attachOriginalVideo(
      session,
      new File(["video"], "edited.mp4", { type: "video/mp4" }),
    );
    video.dispatchEvent(new Event("loadedmetadata"));
    await expect(pending).rejects.toThrow("duration does not match");
    expect(revoke).toHaveBeenCalledWith("blob:original");
    expect(session.video_blob.size).toBe(0);
  });
  it("rejects unreadable videos and nonvideo files without changing the session", async () => {
    const session = createPublicSession(uberEatsCandidates[0], 120000, 0, 60000);
    await expect(
      attachOriginalVideo(session, new File(["text"], "text.txt", { type: "text/plain" })),
    ).rejects.toThrow("MP4 or WebM");
    const pending = attachOriginalVideo(
      session,
      new File(["bad"], "video.mp4", { type: "video/mp4" }),
    );
    video.dispatchEvent(new Event("error"));
    await expect(pending).rejects.toThrow("could not be read");
    expect(revoke).toHaveBeenCalledWith("blob:original");
  });
});
