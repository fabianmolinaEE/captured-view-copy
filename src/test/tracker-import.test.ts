// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_IMPORT_KEY,
  SESSIONS_CHANGED_EVENT,
  autoImportTrackerRuns,
  describeImport,
  importTrackerRuns,
  resetAutoImportForTests,
  trackerRunsFile,
} from "@/lib/research/demo/importTrackerRuns";
import raw from "@/lib/research/demo/uber-eats-tracker-runs.json";
import {
  clearAll,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
} from "@/lib/research/sessionStorage";
import { reviewFinding } from "@/lib/research/review";
import { analysesToday, defaultAgentSettings, usageCapStatus } from "@/lib/research/agentSettings";
import {
  candidateNote,
  isPublicVideo,
  pregeneratedLabel,
  publicSessionNotes,
} from "@/lib/research/publicVideo";
import { sessionsForProduct } from "@/lib/research/products";

const HISTORICAL = "a56d0e77-c712-4f9c-8cb8-ea3659504eb2";
const VOICEOVER = "ee08bb6d-654b-487a-a9bf-05a1ad0f8a48";

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  resetAutoImportForTests();
});

describe("Uber Eats Tracker run import", () => {
  it("imports 5 analyzed public sessions with 8 unaltered findings", async () => {
    const result = await importTrackerRuns();
    expect(result.added).toHaveLength(5);
    expect(result.failed).toEqual([]);
    expect(result.findings_added).toBe(8);
    const sessions = await listSessions();
    expect(sessions).toHaveLength(5);
    expect(sessions.reduce((n, s) => n + s.findings.length, 0)).toBe(8);
    expect(sessionsForProduct(sessions, "uber-eats")).toHaveLength(5);
    for (const video of trackerRunsFile().videos) {
      const session = sessions.find((s) => s.id === video.session_id)!;
      expect(isPublicVideo(session)).toBe(true);
      expect(session.status).toBe("analyzed");
      expect(session.public_video).toMatchObject({
        video_id: video.candidate_id,
        start_ms: video.clip.start_ms,
        end_ms: video.clip.end_ms,
      });
      expect(session.duration_ms).toBe(video.duration_ms);
      // Model output is stored verbatim.
      expect(session.runs).toEqual([video.run]);
      expect(session.findings).toEqual(video.findings);
      expect(session.pregenerated).toMatchObject({
        source: "uber-eats-tracker-runs",
        generated_at: raw.generated_at,
        run_ids: [video.run.id],
      });
    }
    expect(pregeneratedLabel(sessions[0]!)).toBe("Tracker run · pre-generated Nov 13");
  });

  it("is idempotent and never overwrites an edited session", async () => {
    await importTrackerRuns();
    const original = (await getSession(HISTORICAL))!;
    const edited = reviewFinding(original, original.findings[0]!.id, {
      review_status: "accepted",
      reviewer_note: "Checked against the 2020 footage",
    });
    await saveSession(edited);
    await deleteSession(VOICEOVER);

    const events: string[][] = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail.added);
    window.addEventListener(SESSIONS_CHANGED_EVENT, listener);
    const second = await importTrackerRuns();
    window.removeEventListener(SESSIONS_CHANGED_EVENT, listener);

    expect(second.added).toEqual([VOICEOVER]);
    expect(second.skipped).toHaveLength(4);
    expect(events).toEqual([[VOICEOVER]]);
    expect((await getSession(HISTORICAL))?.findings[0]).toMatchObject({
      review_status: "accepted",
      reviewer_note: "Checked against the 2020 footage",
    });
    const third = await importTrackerRuns();
    expect(third.added).toEqual([]);
    expect(describeImport(third)).toMatch(/nothing was changed/);
    expect(await listSessions()).toHaveLength(5);
  });

  it("shares one run across concurrent calls (StrictMode double effect)", async () => {
    const [a, b] = await Promise.all([importTrackerRuns(), importTrackerRuns()]);
    expect(a).toBe(b);
    expect(await listSessions()).toHaveLength(5);
  });

  it("auto-imports once per browser and does not resurrect deleted sessions", async () => {
    expect((await autoImportTrackerRuns())?.added).toHaveLength(5);
    expect(window.localStorage.getItem(DEMO_IMPORT_KEY)).toBeTruthy();
    await deleteSession(VOICEOVER);
    resetAutoImportForTests();
    expect(await autoImportTrackerRuns()).toBeNull();
    expect(await getSession(VOICEOVER)).toBeUndefined();
  });

  it("re-imports when IndexedDB was wiped but the localStorage flag survived", async () => {
    expect((await autoImportTrackerRuns())?.added).toHaveLength(5);
    await clearAll();
    resetAutoImportForTests();
    expect(window.localStorage.getItem(DEMO_IMPORT_KEY)).toBeTruthy();
    expect((await autoImportTrackerRuns())?.added).toHaveLength(5);
    expect(await listSessions()).toHaveLength(5);
  });

  it("excludes imported runs from the daily usage cap, but counts later re-analyses", async () => {
    await importTrackerRuns();
    const sessions = await listSessions();
    const runDay = new Date(trackerRunsFile().videos[0]!.run.started_at);
    expect(analysesToday(sessions, runDay)).toBe(0);
    expect(usageCapStatus(sessions, defaultAgentSettings, "tracker", runDay).used).toBe(0);
    const session = sessions[0]!;
    const rerun = { ...session.runs[0]!, id: "later-real-run" };
    expect(analysesToday([{ ...session, runs: [...session.runs, rerun] }], runDay)).toBe(1);
  });

  it("labels the historical and no-insight clips", async () => {
    await importTrackerRuns();
    expect(candidateNote("Xkv-FUvspg0")).toBe("Historical UI (2020)");
    expect(candidateNote("EFCmkDTBYck")).toBeUndefined();
    expect(publicSessionNotes((await getSession(HISTORICAL))!)).toEqual(["Historical UI (2020)"]);
    expect(publicSessionNotes((await getSession(VOICEOVER))!)).toEqual([
      "Tracker found no insights in this clip",
    ]);
  });
});
