// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useResearchSession } from "@/hooks/use-research-session";
import {
  DEMO_IMPORT_KEY,
  SESSIONS_CHANGED_EVENT,
  applyCuration,
  autoImportTrackerRuns,
  buildTrackerSession,
  curatedCopyToSave,
  describeImport,
  RemovedDemoSessionError,
  importTrackerRuns,
  resetAutoImportForTests,
  trackerRunsFile,
} from "@/lib/research/demo/importTrackerRuns";
import {
  EXPLORER_IMPORT_KEY,
  autoImportExplorerRuns,
  buildExplorerSession,
  explorerRunsFile,
  reimportAllDemoRuns,
  resetExplorerAutoImportForTests,
} from "@/lib/research/demo/importExplorerRuns";
import { clearAll, getSession, listSessions, saveSession } from "@/lib/research/sessionStorage";
import { reviewFinding } from "@/lib/research/review";
import { acceptAndApprove } from "@/lib/research/testDecisions";
import {
  listSimulatedRuns,
  resetSimulatedDemo,
  startSimulatedRun,
} from "@/lib/research/simulation";
import {
  buildUnifiedInsights,
  isRetiredDemoSession,
  shownFindings,
} from "@/lib/research/unifiedInsights";
import type { Finding, Session } from "@/lib/research/types";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";

/**
 * Browsers that imported the older, larger bundles (5 Uber Eats + 4 DoorDash sessions) are
 * migrated to the curated demo set. These fixtures recreate that older shape from the bundled
 * kept run: the extra findings below stand in for the removed model findings.
 */
const trackerVideo = trackerRunsFile().videos[0]!;
const explorerVideo = explorerRunsFile().videos[0]!;
const KEPT_TRACKER = trackerVideo.session_id;
const KEPT_EXPLORER = explorerVideo.session_id;

function extraFinding(base: Finding, id: string, title: string, sessionId = base.session_id) {
  return { ...base, id, title, session_id: sessionId };
}
/** An older pre-generated session for a video the curated bundle no longer has. */
function retiredSession(kind: "tracker" | "explorer", id: string, runId: string): Session {
  const video = kind === "tracker" ? trackerVideo : explorerVideo;
  const finding = { ...video.findings[0]!, id: `${id}-f`, session_id: id, analysis_run_id: runId };
  const shaped = {
    ...video,
    session_id: id,
    run: { ...video.run, id: runId },
    findings: [finding],
  };
  return kind === "tracker"
    ? buildTrackerSession(shaped as never)
    : buildExplorerSession(shaped as never);
}
const REMOVED_TRACKER_FINDING = "60923714-ab76-4020-bb32-e2d36fd2eda2";
const REMOVED_EXPLORER_FINDING = "45ffaa95-053e-4612-8105-c90ce2c4479a";

async function seedOldImport() {
  // Kept Tracker session as the old bundle stored it: two findings, the kept one reviewed.
  let tracker = buildTrackerSession(trackerVideo as never);
  tracker = {
    ...tracker,
    findings: [
      extraFinding(tracker.findings[0]!, REMOVED_TRACKER_FINDING, "Nested Uber Eats entry point"),
      ...tracker.findings,
    ],
  };
  tracker = reviewFinding(tracker, trackerVideo.findings[0]!.id, {
    review_status: "accepted",
    reviewer_note: "Matches the footage at 0:29",
  });
  tracker = acceptAndApprove(tracker, trackerVideo.findings[0]!.id);
  tracker = {
    ...tracker,
    matches: [
      {
        finding_id: REMOVED_TRACKER_FINDING,
        ground_truth_issue_id: null,
        reviewer_verified: false,
        video_necessary: "unknown",
        evidence_verified: false,
      },
    ],
  };
  let explorer = buildExplorerSession(explorerVideo as never);
  explorer = {
    ...explorer,
    findings: [
      extraFinding(
        explorer.findings[0]!,
        REMOVED_EXPLORER_FINDING,
        "Proactive Fee Policy Explanation",
      ),
      ...explorer.findings,
    ],
  };
  explorer = reviewFinding(explorer, explorerVideo.findings[0]!.id, {
    review_status: "rejected",
    reviewer_note: "Not for us",
  });
  const retiredTracker = retiredSession(
    "tracker",
    "75f7d43d-b250-43dc-8df2-5f14c420684a",
    "old-tracker-run",
  );
  const retiredExplorer = retiredSession(
    "explorer",
    "771e5c45-bedd-457d-9276-4fa64f0b7b43",
    "old-explorer-run",
  );
  // An older pre-generated session the user later re-analyzed: it holds their own run.
  const reanalyzed = retiredSession(
    "tracker",
    "48933c97-f06b-4ef0-adc8-303c2f7b743d",
    "old-tracker-run-2",
  );
  const userRun = makeRun({ id: "user-run", mode: "public_video" });
  reanalyzed.runs.push(userRun);
  reanalyzed.findings.push(
    makeFinding({ id: "user-finding", session_id: reanalyzed.id, analysis_run_id: userRun.id }),
  );
  // The user's own recordings: no pregenerated marker.
  const bag = makeSession({ source_app: "Bag checkout app", title: "My bag checkout" });
  const ownUber = makeSession({ source_app: "Uber Eats", title: "My own Uber Eats analysis" });
  for (const session of [
    tracker,
    explorer,
    retiredTracker,
    retiredExplorer,
    reanalyzed,
    bag,
    ownUber,
  ])
    await saveSession(session);
  // Simulated runs from the old insights.
  startSimulatedRun(tracker.findings[0]!, "experiment", { product_id: "uber-eats" });
  startSimulatedRun(retiredTracker.findings[0]!, "experiment", { product_id: "uber-eats" });
  startSimulatedRun(tracker.findings[1]!, "experiment", { product_id: "uber-eats" });
  window.localStorage.setItem(DEMO_IMPORT_KEY, "uber-eats-tracker-runs@2026-11-13");
  window.localStorage.setItem(EXPLORER_IMPORT_KEY, "doordash-explorer-runs@2026-11-13");
  return { tracker, explorer, retiredTracker, retiredExplorer, reanalyzed, bag, ownUber };
}

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  resetAutoImportForTests();
  resetExplorerAutoImportForTests();
  resetSimulatedDemo();
});

describe("curated demo migration", () => {
  it("prunes an older import to the curated set without touching user sessions", async () => {
    const old = await seedOldImport();
    const events: string[][] = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail.added);
    window.addEventListener(SESSIONS_CHANGED_EVENT, listener);
    const [tracker, explorer] = await Promise.all([
      autoImportTrackerRuns(),
      autoImportExplorerRuns(),
    ]);
    window.removeEventListener(SESSIONS_CHANGED_EVENT, listener);

    expect(tracker).toMatchObject({
      added: [],
      pruned: [old.retiredTracker.id],
      curated: [KEPT_TRACKER],
      kept_user_runs: [old.reanalyzed.id],
      failed: [],
    });
    expect(explorer).toMatchObject({
      added: [],
      pruned: [old.retiredExplorer.id],
      curated: [KEPT_EXPLORER],
      failed: [],
    });
    expect(events.flat().sort()).toEqual(
      [old.retiredTracker.id, KEPT_TRACKER, old.retiredExplorer.id, KEPT_EXPLORER].sort(),
    );
    expect(describeImport(tracker!)).toMatch(/Removed 1 older Tracker run/);
    expect(window.localStorage.getItem(DEMO_IMPORT_KEY)).toBe(
      "uber-eats-tracker-runs@2026-11-13-curated",
    );

    // Kept sessions: only the curated finding, with the human decisions intact; runs verbatim.
    const keptTracker = (await getSession(KEPT_TRACKER))!;
    expect(keptTracker.findings.map((f) => f.title)).toEqual(["Hidden minimum order threshold"]);
    expect(keptTracker.findings[0]).toMatchObject({
      review_status: "accepted",
      reviewer_note: "Matches the footage at 0:29",
      test_decision: expect.objectContaining({ decision: "approved" }),
      title: trackerVideo.findings[0]!.title,
      description: trackerVideo.findings[0]!.description,
    });
    expect(keptTracker.runs).toEqual([trackerVideo.run]);
    expect(keptTracker.matches).toEqual([]);
    const keptExplorer = (await getSession(KEPT_EXPLORER))!;
    expect(keptExplorer.findings.map((f) => f.title)).toEqual(["Cart Complement Recommendations"]);
    expect(keptExplorer.findings[0]).toMatchObject({
      review_status: "rejected",
      reviewer_note: "Not for us",
    });
    expect(keptExplorer.runs).toEqual([explorerVideo.run]);

    // Retired sessions are gone; the re-analyzed one and the user's own sessions are untouched.
    expect(await getSession(old.retiredTracker.id)).toBeUndefined();
    expect(await getSession(old.retiredExplorer.id)).toBeUndefined();
    for (const own of [old.reanalyzed, old.bag, old.ownUber]) {
      const stored = (await getSession(own.id))!;
      expect(stored.findings).toEqual(own.findings);
      expect(stored.runs).toEqual(own.runs);
      expect(stored.title).toBe(own.title);
    }
    expect((await listSessions()).map((s) => s.id).sort()).toEqual(
      [KEPT_TRACKER, KEPT_EXPLORER, old.reanalyzed.id, old.bag.id, old.ownUber.id].sort(),
    );

    // Simulated runs from removed insights are discarded; the kept insight's run stays.
    expect(listSimulatedRuns().map((run) => run.finding_id)).toEqual([
      trackerVideo.findings[0]!.id,
    ]);

    // Idempotent: a second pass (Settings → Re-import) changes nothing.
    const again = await reimportAllDemoRuns();
    expect(again.tracker).toMatchObject({ added: [], pruned: [], curated: [] });
    expect(again.explorer).toMatchObject({ added: [], pruned: [], curated: [] });
    expect(again.message).toMatch(/No Tracker runs were missing/);
    expect((await getSession(KEPT_TRACKER))!.findings[0]!.reviewer_note).toBe(
      "Matches the footage at 0:29",
    );
  });

  it("re-import follows the curated set and restores a missing curated finding", async () => {
    const stale = buildTrackerSession(trackerVideo as never);
    await saveSession({ ...stale, findings: [] });
    const result = await importTrackerRuns();
    expect(result.curated).toEqual([KEPT_TRACKER]);
    expect((await getSession(KEPT_TRACKER))!.findings).toEqual(trackerVideo.findings);
  });

  it("shows exactly the three demo insights for Uber Eats, in order, after migration", async () => {
    const old = await seedOldImport();
    await Promise.all([autoImportTrackerRuns(), autoImportExplorerRuns()]);
    const sessions = await listSessions();
    const items = buildUnifiedInsights(sessions, "uber-eats");
    expect(items.slice(0, 3).map((i) => [i.title, i.source])).toEqual([
      ["Order again on the home screen", "both"],
      ["Hidden minimum order threshold", "tracker"],
      ["Cart Complement Recommendations", "explorer"],
    ]);
    // Anything after the three demo insights is the user's own analysis, never demo data.
    expect(
      items
        .slice(3)
        .map((i) => i.session_ids[0])
        .sort(),
    ).toEqual([old.reanalyzed.id, old.ownUber.id].sort());
    expect(buildUnifiedInsights(sessions, "checkout").map((i) => i.session_ids[0])).toEqual([
      old.bag.id,
    ]);
    // Without the user's own Uber Eats analyses there are exactly three.
    const demoOnly = sessions.filter((s) => s.id !== old.ownUber.id && s.id !== old.reanalyzed.id);
    expect(buildUnifiedInsights(demoOnly, "uber-eats")).toHaveLength(3);
  });

  it("a fresh browser gets exactly the three demo insights for Uber Eats, in order", async () => {
    const [tracker, explorer] = await Promise.all([
      autoImportTrackerRuns(),
      autoImportExplorerRuns(),
    ]);
    expect(tracker).toMatchObject({ added: [KEPT_TRACKER], pruned: [], failed: [] });
    expect(explorer).toMatchObject({ added: [KEPT_EXPLORER], pruned: [], failed: [] });
    const sessions = await listSessions();
    expect(sessions.map((s) => s.id).sort()).toEqual([KEPT_TRACKER, KEPT_EXPLORER].sort());
    const items = buildUnifiedInsights(sessions, "uber-eats");
    expect(items.map((i) => [i.title, i.source])).toEqual([
      ["Order again on the home screen", "both"],
      ["Hidden minimum order threshold", "tracker"],
      ["Cart Complement Recommendations", "explorer"],
    ]);
    expect(buildUnifiedInsights(sessions, "checkout")).toEqual([]);
  });

  it("hides retired pre-generated findings before the migration has run", async () => {
    const old = await seedOldImport();
    const items = buildUnifiedInsights(
      [old.tracker, old.explorer, old.retiredTracker, old.retiredExplorer],
      "uber-eats",
    );
    expect(items.map((i) => i.title)).toEqual([
      "Order again on the home screen",
      "Hidden minimum order threshold",
      "Cart Complement Recommendations",
    ]);
    // The user's own later analysis on an older pre-generated session is not hidden.
    expect(
      buildUnifiedInsights([old.reanalyzed], "uber-eats", { includeSample: false }).map(
        (i) => i.key,
      ),
    ).toEqual([`${old.reanalyzed.id}:user-finding`]);
  });

  it("HQ counts skip retired pre-generated sessions and findings before the migration", async () => {
    const old = await seedOldImport();
    expect(isRetiredDemoSession(old.retiredTracker)).toBe(true);
    expect(isRetiredDemoSession(old.retiredExplorer)).toBe(true);
    // Kept sessions, a re-analyzed session and the user's own recordings are not retired.
    for (const session of [old.tracker, old.explorer, old.reanalyzed, old.bag, old.ownUber])
      expect(isRetiredDemoSession(session)).toBe(false);
    expect(shownFindings(old.tracker).map((f) => f.id)).toEqual([trackerVideo.findings[0]!.id]);
    expect(shownFindings(old.explorer).map((f) => f.id)).toEqual([explorerVideo.findings[0]!.id]);
  });

  it("a save from a page opened before the migration cannot revive removed findings", async () => {
    const old = await seedOldImport();
    await importTrackerRuns();
    // The page still holds the pre-migration copy with the removed finding.
    const saved = await curatedCopyToSave(old.tracker);
    expect(saved.findings.map((f) => f.id)).toEqual([trackerVideo.findings[0]!.id]);
    expect(saved.matches).toEqual([]);
    // A deleted retired session is not written back.
    await expect(curatedCopyToSave(old.retiredTracker)).rejects.toBeInstanceOf(
      RemovedDemoSessionError,
    );
    // The user's own sessions pass through untouched.
    expect(await curatedCopyToSave(old.bag)).toBe(old.bag);
  });

  it("an open detail page drops a session the migration deleted and does not save it back", async () => {
    const old = await seedOldImport();
    const { result } = renderHook(() => useResearchSession(old.retiredTracker.id));
    await waitFor(() => expect(result.current.session?.id).toBe(old.retiredTracker.id));
    await act(async () => {
      await importTrackerRuns();
    });
    await waitFor(() => expect(result.current.session).toBeUndefined());
    expect(await getSession(old.retiredTracker.id)).toBeUndefined();
  });

  it("an open detail page saving a stale kept session keeps only the curated finding", async () => {
    const old = await seedOldImport();
    const { result } = renderHook(() => useResearchSession(old.tracker.id));
    await waitFor(() => expect(result.current.session?.findings).toHaveLength(2));
    // Migration runs without notifying this page, as if the event was missed.
    await applyCuration("uber-eats-tracker-runs", trackerRunsFile().videos);
    await act(async () => {
      await result.current.update((current) =>
        reviewFinding(current, trackerVideo.findings[0]!.id, { reviewer_note: "Seen at 0:31" }),
      );
    });
    const stored = await getSession(old.tracker.id);
    expect(stored?.findings.map((f) => f.id)).toEqual([trackerVideo.findings[0]!.id]);
    expect(stored?.findings[0]!.reviewer_note).toBe("Seen at 0:31");
    expect(result.current.session?.findings).toHaveLength(1);
  });
});
