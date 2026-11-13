// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  clearAll,
  saveSession,
  getSession,
  listSessions,
  deleteSession,
  getSampling,
  saveSampling,
} from "@/lib/research/sessionStorage";
import { reviewFinding } from "@/lib/research/review";
import { makeSession, modelOutput } from "./research-fixtures";
beforeEach(() => clearAll());
describe("IndexedDB persistence", () => {
  it("round-trips recording bytes, synchronized events, and reviewer decisions after reopening", async () => {
    const s = makeSession();
    s.runs[0]!.raw_output = modelOutput();
    await saveSession(s);
    const edited = reviewFinding(s, s.findings[0]!.id, {
      review_status: "rejected",
      reviewer_note: "Verified after replay",
    });
    await saveSession(edited);
    const loaded = await getSession(s.id);
    expect(loaded?.findings[0]).toMatchObject({
      review_status: "rejected",
      reviewer_note: "Verified after replay",
    });
    expect(loaded?.runs[0]?.raw_output).toEqual(modelOutput());
    expect(loaded?.events).toEqual(s.events);
    expect(await loaded?.video_blob.text()).toBe(await s.video_blob.text());
    expect(await listSessions()).toHaveLength(1);
    await deleteSession(s.id);
    expect(await getSession(s.id)).toBeUndefined();
  });
  it("persists and clears sampling preferences independently of session metadata", async () => {
    const settings = { interval_seconds: 1, max_frames: 12, max_width: 640 };
    await saveSampling(settings);
    expect(await getSampling()).toEqual(settings);
    await clearAll();
    expect((await getSampling()).max_frames).toBe(24);
  });
});
