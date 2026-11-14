import { beforeEach, describe, expect, it } from "vitest";
import {
  FEATURED_EXPLORER_FINDING_ID,
  FEATURED_TRACKER_FINDING_ID,
  ORDER_AGAIN_FINDING_ID,
  ORDER_AGAIN_KEY,
  SAMPLE_SESSION_ID,
  getSampleInsight,
  isSampleInsightRoute,
  sampleInsightFor,
} from "@/lib/research/demo/happyPath";
import { buildExplorerSession, explorerRunsFile } from "@/lib/research/demo/importExplorerRuns";
import { buildTrackerSession, trackerRunsFile } from "@/lib/research/demo/importTrackerRuns";
import { aggregateInsights } from "@/lib/research/insights";
import { reviewFinding } from "@/lib/research/review";
import { acceptAndApprove } from "@/lib/research/testDecisions";
import {
  approveSampleTest,
  diffStats,
  fastForwardRun,
  happyPathRun,
  listSimulatedRuns,
  mergePr,
  prReview,
  readSimulationStore,
  rejectSampleTest,
  resetSimulatedDemo,
  runStage,
  sampleDecisionOf,
  seedSampleLoop,
  startSampleTestRun,
} from "@/lib/research/simulation";
import {
  buildUnifiedInsights,
  featuredUnified,
  filterUnified,
  sourceFilterFromTab,
  videoCountLabel,
  videoCountThresholds,
} from "@/lib/research/unifiedInsights";

const tracker = trackerRunsFile().videos.map((v) => buildTrackerSession(v as never));
const explorer = explorerRunsFile().videos.map((v) => buildExplorerSession(v as never));
const sessions = [...tracker, ...explorer];

beforeEach(() => resetSimulatedDemo());

describe("happy-path sample", () => {
  it("is addressable and labeled", () => {
    const sample = getSampleInsight(SAMPLE_SESSION_ID, ORDER_AGAIN_FINDING_ID)!;
    expect(sample.simulated).toBe(true);
    expect(sample.source).toBe("both");
    expect(sample.seen_in.label).toMatch(/14 of 50 sessions · sample/);
    expect(isSampleInsightRoute("sample", "order-again")).toBe(true);
    expect(getSampleInsight("sample", "other")).toBeNull();
    expect(sampleInsightFor("checkout")).toBeNull();
  });
});

describe("unified insights", () => {
  it("combines tracker, explorer and the sample with source tags and video counts", () => {
    const items = buildUnifiedInsights(sessions, "uber-eats");
    expect(items.some((i) => i.source === "tracker")).toBe(true);
    expect(items.some((i) => i.source === "explorer" && i.competitor === "DoorDash")).toBe(true);
    const sample = items.find((i) => i.key === ORDER_AGAIN_KEY)!;
    expect(sample.kind).toBe("sample");
    expect(sample.link.params).toEqual({ sessionId: "sample", findingId: "order-again" });
    for (const item of items.filter((i) => i.kind === "real")) expect(item.video_count).toBe(1);
    expect(videoCountLabel(1)).toBe("from 1 video");
    expect(videoCountLabel(16)).toBe("from 16 videos");
    expect(featuredUnified(items).map((i) => i.source)).toEqual(["both", "tracker", "explorer"]);
    // Pending first.
    const firstDone = items.findIndex((i) => !i.needs_attention);
    if (firstDone !== -1)
      expect(items.slice(firstDone).every((i) => !i.needs_attention)).toBe(true);
  });

  it("shows exactly the three demo insights for Uber Eats: Both, Tracker, Explorer", () => {
    const items = buildUnifiedInsights(sessions, "uber-eats");
    expect(items.map((i) => [i.title, i.source])).toEqual([
      ["Order again on the home screen", "both"],
      ["Hidden minimum order threshold", "tracker"],
      ["Cart Complement Recommendations", "explorer"],
    ]);
    expect(trackerRunsFile().curation.kept_finding_ids).toEqual([FEATURED_TRACKER_FINDING_ID]);
    expect(explorerRunsFile().curation.kept_finding_ids).toEqual([FEATURED_EXPLORER_FINDING_ID]);
    // The order stays fixed after a decision (no reshuffle once the Tracker one is approved).
    const decided = tracker.map((s) =>
      acceptAndApprove(
        reviewFinding(s, FEATURED_TRACKER_FINDING_ID, { review_status: "accepted" }),
        FEATURED_TRACKER_FINDING_ID,
      ),
    );
    const after = buildUnifiedInsights([...decided, ...explorer], "uber-eats");
    expect(after.map((i) => i.source)).toEqual(["both", "tracker", "explorer"]);
    expect(after[1]!.needs_attention).toBe(false);
  });

  it("filters by source and minimum video count", () => {
    const items = buildUnifiedInsights(sessions, "uber-eats");
    const ex = filterUnified(items, { source: "explorer" });
    expect(ex.every((i) => i.source === "explorer" || i.source === "both")).toBe(true);
    expect(filterUnified(items, { minVideos: 2 }).map((i) => i.key)).toEqual([ORDER_AGAIN_KEY]);
    expect(videoCountThresholds(items)).toEqual([1, 16]);
    expect(sourceFilterFromTab("competitors")).toBe("explorer");
    expect(sourceFilterFromTab(undefined)).toBe("all");
  });

  it("keeps competitor footage and samples out of own-product metrics", () => {
    const keys = aggregateInsights(sessions).flatMap((i) => i.evidence.map((e) => e.session.id));
    expect(keys.some((id) => explorer.some((s) => s.id === id))).toBe(false);
    expect(buildUnifiedInsights(sessions, "checkout")).toEqual([]);
    expect(buildUnifiedInsights(sessions, null)).toEqual([]);
  });

  it("reflects the stored sample decision", () => {
    startSampleTestRun();
    const decision = sampleDecisionOf(readSimulationStore());
    const sample = buildUnifiedInsights(sessions, "uber-eats", { sampleDecision: decision }).find(
      (i) => i.kind === "sample",
    )!;
    expect(sample.decision).toBe("approved");
    expect(sample.needs_attention).toBe(false);
  });
});

describe("happy-path simulation", () => {
  it("approving starts one idempotent experiment run with review content", () => {
    const start = new Date("2026-11-13T10:00:00Z");
    const run = startSampleTestRun(start);
    expect(startSampleTestRun(start).id).toBe(run.id);
    expect(run).toMatchObject({ simulated: true, kind: "experiment", happy_path: true });
    expect(run.insight_source).toBe("both");
    const review = prReview(run);
    expect(review.diffs.map((d) => d.path)).toEqual([
      "src/features/home/HomeScreen.tsx",
      "src/features/home/OrderAgainRail.tsx",
      "src/experiments/flags.ts",
      "src/features/home/__tests__/OrderAgainRail.test.tsx",
    ]);
    expect(diffStats(review.diffs).additions).toBeGreaterThan(40);
    expect(review.analytics.metrics[0]).toMatchObject({
      metric: "Reorders per user",
      role: "primary",
    });
    expect(review.analytics.illustrative).toBe(true);
    expect(() => mergePr(run.id, start.getTime() + 1000)).toThrow();
    const done = start.getTime() + run.duration_ms;
    expect(runStage(run, done).prReady).toBe(true);
    const merged = mergePr(run.id, done);
    expect(merged.pr.status).toBe("merged");
    expect(merged.pr.merged_at).toBe(new Date(done).toISOString());
    expect(happyPathRun(listSimulatedRuns())?.id).toBe(run.id);
  });

  it("uses the reviewer's edited test, can approve without a run, and fast-forwards", () => {
    approveSampleTest(new Date("2026-11-13T09:00:00Z"));
    expect(sampleDecisionOf(readSimulationStore()).decision).toBe("approved");
    expect(happyPathRun(listSimulatedRuns())).toBeUndefined();
    const edited = {
      ...getSampleInsight(SAMPLE_SESSION_ID, ORDER_AGAIN_FINDING_ID)!.suggested_test,
    };
    edited.change = "Show an Order again row at the top of home";
    const run = startSampleTestRun(new Date(), edited);
    expect(run.test.change).toBe("Show an Order again row at the top of home");
    expect(runStage(run).prReady).toBe(false);
    const forwarded = fastForwardRun(run.id)!;
    expect(runStage(forwarded).prReady).toBe(true);
    expect(happyPathRun(listSimulatedRuns())?.started_at).toBe(forwarded.started_at);
    expect(fastForwardRun("missing")).toBeNull();
  });

  it("reject discards the run; generic runs and seeded samples still get diffs", () => {
    startSampleTestRun();
    rejectSampleTest();
    expect(happyPathRun(listSimulatedRuns())).toBeUndefined();
    expect(sampleDecisionOf(readSimulationStore()).decision).toBe("rejected");
    const seeded = seedSampleLoop("uber-eats");
    expect(seeded.length).toBe(2);
    for (const run of seeded) expect(prReview(run).diffs.length).toBeGreaterThan(0);
  });
});
