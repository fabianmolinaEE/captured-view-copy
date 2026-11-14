// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_IMPORT_KEY,
  SESSIONS_CHANGED_EVENT,
  autoImportTrackerRuns,
  buildTrackerSession,
  describeImport,
  importTrackerRuns,
  resetAutoImportForTests,
  trackerRunsFile,
} from "@/lib/research/demo/importTrackerRuns";
import raw from "@/lib/research/demo/uber-eats-tracker-runs.json";
import { FEATURED_TRACKER_FINDING_ID } from "@/lib/research/demo/happyPath";
import {
  clearAll,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
} from "@/lib/research/sessionStorage";
import { reviewFinding } from "@/lib/research/review";
import { analysesToday, defaultAgentSettings, usageCapStatus } from "@/lib/research/agentSettings";
import { isPublicVideo, pregeneratedLabel } from "@/lib/research/publicVideo";
import { sessionsForProduct } from "@/lib/research/products";
import { makeSession } from "./research-fixtures";

const KEPT = "e02675ea-079d-47d7-916b-527f483be7c7";

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  resetAutoImportForTests();
});

describe("Uber Eats Tracker run import (curated demo set)", () => {
  it("imports the one curated session with its one unaltered finding", async () => {
    const result = await importTrackerRuns();
    expect(result.added).toEqual([KEPT]);
    expect(result.failed).toEqual([]);
    expect(result.findings_added).toBe(1);
    const sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessionsForProduct(sessions, "uber-eats")).toHaveLength(1);
    const [video] = trackerRunsFile().videos;
    const session = sessions[0]!;
    expect(session.id).toBe(video!.session_id);
    expect(isPublicVideo(session)).toBe(true);
    expect(session.status).toBe("analyzed");
    expect(session.public_video).toMatchObject({
      video_id: "oDcQjVREO5w",
      start_ms: video!.clip.start_ms,
      end_ms: video!.clip.end_ms,
    });
    expect(session.duration_ms).toBe(video!.duration_ms);
    // Model output is stored verbatim; raw_output keeps the complete original answer.
    expect(session.runs).toEqual([video!.run]);
    expect(session.findings).toEqual(video!.findings);
    expect(session.findings.map((f) => f.title)).toEqual(["Hidden minimum order threshold"]);
    expect(JSON.stringify(session.runs[0]!.raw_output)).toContain("Nested Uber Eats entry point");
    expect(session.pregenerated).toMatchObject({
      source: "uber-eats-tracker-runs",
      generated_at: raw.generated_at,
      run_ids: [video!.run.id],
    });
    expect(pregeneratedLabel(session)).toBe("Tracker run · pre-generated Nov 13");
  });

  it("records the curation in the bundle and matches the featured finding", () => {
    const file = trackerRunsFile();
    expect(file.videos).toHaveLength(1);
    expect(file.curation.kept_session_ids).toEqual([KEPT]);
    expect(file.curation.kept_finding_ids).toEqual([FEATURED_TRACKER_FINDING_ID]);
    expect(file.curation.kept_finding_titles).toEqual(["Hidden minimum order threshold"]);
    expect(file.curation.removed_from_display).toMatch(/user's request/);
    expect(file.curation.removed_from_display).toMatch(/raw_output/);
  });

  it("is idempotent and never overwrites an edited session", async () => {
    await importTrackerRuns();
    const original = (await getSession(KEPT))!;
    const edited = reviewFinding(original, original.findings[0]!.id, {
      review_status: "accepted",
      reviewer_note: "Checked against the footage",
    });
    await saveSession(edited);

    const events: string[][] = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail.added);
    window.addEventListener(SESSIONS_CHANGED_EVENT, listener);
    const second = await importTrackerRuns();
    window.removeEventListener(SESSIONS_CHANGED_EVENT, listener);

    expect(second.added).toEqual([]);
    expect(second.skipped).toEqual([KEPT]);
    expect(second.pruned).toEqual([]);
    expect(second.curated).toEqual([]);
    expect(events).toEqual([]);
    expect(describeImport(second)).toMatch(/nothing was changed/);
    expect((await getSession(KEPT))?.findings[0]).toMatchObject({
      review_status: "accepted",
      reviewer_note: "Checked against the footage",
    });

    await deleteSession(KEPT);
    const third = await importTrackerRuns();
    expect(third.added).toEqual([KEPT]);
    expect(await listSessions()).toHaveLength(1);
  });

  it("shares one run across concurrent calls (StrictMode double effect)", async () => {
    const [a, b] = await Promise.all([importTrackerRuns(), importTrackerRuns()]);
    expect(a).toBe(b);
    expect(await listSessions()).toHaveLength(1);
  });

  it("auto-imports once per browser and does not resurrect a deleted session while others remain", async () => {
    const own = makeSession({ source_app: "Bag checkout app" });
    await saveSession(own);
    expect((await autoImportTrackerRuns())?.added).toEqual([KEPT]);
    expect(window.localStorage.getItem(DEMO_IMPORT_KEY)).toBe(
      "uber-eats-tracker-runs@2026-11-13-curated",
    );
    await deleteSession(KEPT);
    resetAutoImportForTests();
    expect(await autoImportTrackerRuns()).toBeNull();
    expect(await getSession(KEPT)).toBeUndefined();
  });

  it("re-imports when IndexedDB was wiped but the localStorage flag survived", async () => {
    expect((await autoImportTrackerRuns())?.added).toHaveLength(1);
    await clearAll();
    resetAutoImportForTests();
    expect(window.localStorage.getItem(DEMO_IMPORT_KEY)).toBeTruthy();
    expect((await autoImportTrackerRuns())?.added).toHaveLength(1);
    expect(await listSessions()).toHaveLength(1);
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

  it("builds sessions only from consistent bundled data", () => {
    const video = trackerRunsFile().videos[0]!;
    expect(() =>
      buildTrackerSession({
        ...video,
        findings: [{ ...video.findings[0]!, session_id: "other" }],
      } as never),
    ).toThrow(/does not belong/);
  });
});
