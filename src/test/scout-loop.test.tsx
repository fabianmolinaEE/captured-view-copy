import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  acceptAndApprove,
  approvalBlocker,
  approveTest,
  editTest,
  effectiveRoute,
  effectiveTest,
  rejectTest,
  revertTestEdits,
  setRoute,
  testSourceLabel,
} from "@/lib/research/testDecisions";
import { reviewFinding } from "@/lib/research/review";
import {
  AGENT_SETTINGS_KEY,
  analysesToday,
  defaultAgentSettings,
  loadAgentSettings,
  sanitizeAgentSettings,
  splitByConfidence,
  usageCapStatus,
} from "@/lib/research/agentSettings";
import {
  EXPERIMENT_DURATION_MS,
  SIMULATION_KEY,
  closePr,
  discardRunsForSession,
  ideaSourceFor,
  illustrativeDeltas,
  listSimulatedRuns,
  mergePr,
  resetSimulatedDemo,
  runStage,
  seedSampleLoop,
  startSimulatedRun,
} from "@/lib/research/simulation";
import {
  competitorOf,
  competitorSessionsFor,
  createCompetitorSession,
  doorDashCandidates,
  isCompetitorSession,
} from "@/lib/research/competitors";
import { aggregateInsights } from "@/lib/research/insights";
import { score } from "@/lib/research/evaluation";
import { sessionsForProduct } from "@/lib/research/products";
import { analyzeSession, checkUsageCap } from "@/lib/research/apiClient";
import { useSimulation } from "@/hooks/use-simulation";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";

const test = {
  hypothesis: "If we enlarge the button, then fewer taps miss because the target is bigger.",
  change: "Full-width add button.",
  primary_metric: "missed taps before adding",
};
function sessionWith(patch: Parameters<typeof makeFinding>[0] = {}) {
  const run = makeRun();
  const finding = makeFinding({
    analysis_run_id: run.id,
    review_status: "pending",
    suggested_test: test,
    ...patch,
  });
  return {
    session: makeSession({ runs: [run], findings: [finding], status: "analyzed" }),
    id: finding.id,
  };
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("test decisions", () => {
  it("approves only accepted insights and offers one-step accept and approve", () => {
    const { session, id } = sessionWith();
    expect(() => approveTest(session, id)).toThrow("Accept the insight");
    const both = acceptAndApprove(session, id);
    const finding = both.findings[0]!;
    expect(finding.review_status).toBe("accepted");
    expect(finding.test_decision).toMatchObject({ decision: "approved", edited: false });
    expect(finding.test_decision?.decided_at).toBeTruthy();
    expect(both.status).toBe("reviewed");
    expect(finding.suggested_test).toEqual(test);
  });
  it("resets approval when the insight is rejected or reopened, or the test is edited", () => {
    const { session, id } = sessionWith();
    const approved = acceptAndApprove(session, id);
    for (const status of ["rejected", "pending"] as const) {
      const next = reviewFinding(approved, id, { review_status: status }).findings[0]!;
      expect(next.test_decision?.decision).toBe("pending");
      expect(next.test_decision).not.toHaveProperty("decided_at");
    }
    const edited = editTest(approved, id, { ...test, change: "Bigger button" }).findings[0]!;
    expect(edited.test_decision).toMatchObject({ decision: "pending", edited: true });
    expect(edited.suggested_test).toEqual(test);
    expect(effectiveTest(edited)?.change).toBe("Bigger button");
    expect(testSourceLabel(edited)).toBe("Edited by reviewer");
    const reverted = revertTestEdits({ ...approved, findings: [edited] }, id).findings[0]!;
    expect(testSourceLabel(reverted)).toBe("Agent suggestion");
    expect(reverted.test_decision).not.toHaveProperty("edited_test");
    const rejected = rejectTest(approved, id).findings[0]!;
    expect(rejected.test_decision?.decision).toBe("rejected");
  });
  it("blocks approval on empty fields per route and resets on a route change", () => {
    const { session, id } = sessionWith({ review_status: "accepted" });
    const empty = editTest(session, id, { hypothesis: " ", change: "Bigger", primary_metric: "" });
    expect(approvalBlocker(empty.findings[0]!)).toContain("hypothesis, change and primary metric");
    const asFix = setRoute(empty, id, "fix");
    expect(effectiveRoute(asFix.findings[0]!)).toBe("fix");
    expect(approvalBlocker(asFix.findings[0]!)).toBeNull();
    const approvedFix = approveTest(asFix, id);
    const back = setRoute(approvedFix, id, "experiment").findings[0]!;
    expect(back.test_decision).toMatchObject({ decision: "pending", route_override: "experiment" });
    const noChange = editTest(asFix, id, { hypothesis: "", change: "", primary_metric: "" });
    expect(approvalBlocker(noChange.findings[0]!)).toContain("Describe the fix");
  });
  it("lets a fix approve from the insight's recommendation, as the simulated Fixer run does", () => {
    const { session, id } = sessionWith({
      review_status: "accepted",
      suggested_route: "fix",
      suggested_test: undefined,
      recommendation: "Make the add button full width.",
    });
    expect(approvalBlocker(session.findings[0]!)).toBeNull();
    expect(approvalBlocker({ ...session.findings[0]!, review_status: "pending" })).toBe(
      "Accept the insight before approving its fix.",
    );
  });
  it("defaults to the model route, then experiment", () => {
    expect(effectiveRoute(makeFinding({ suggested_route: "fix" }))).toBe("fix");
    expect(effectiveRoute(makeFinding())).toBe("experiment");
  });
});

describe("agent settings", () => {
  it("sanitizes stored values and drops focus areas for scouts that do not analyze", () => {
    const clean = sanitizeAgentSettings({
      tracker: {
        enabled: false,
        focus_areas: ["trust", "bogus", "copy"],
        min_confidence: 4,
        max_analyses_per_day: -3,
      },
      fixer: { focus_areas: ["copy"], cadence: "every second" },
      unknown: {},
    });
    expect(clean.tracker).toMatchObject({
      enabled: false,
      focus_areas: ["copy", "trust"],
      min_confidence: 1,
      max_analyses_per_day: 0,
    });
    expect(clean.fixer).toMatchObject({
      focus_areas: [],
      cadence: defaultAgentSettings.fixer.cadence,
    });
    expect(Object.keys(clean)).toEqual(["tracker", "explorer", "fixer", "experimenter"]);
    localStorage.setItem(AGENT_SETTINGS_KEY, "{not json");
    expect(loadAgentSettings()).toEqual(defaultAgentSettings);
  });
  it("counts today's real runs per scout and blocks Analyze at the cap", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 36 * 3600 * 1000).toISOString();
    const own = makeSession({
      runs: [
        makeRun({ started_at: now.toISOString() }),
        makeRun({ status: "failed", started_at: now.toISOString() }),
        makeRun({ status: "failed", started_at: now.toISOString(), reached_provider: false }),
        makeRun({ started_at: yesterday }),
      ],
    });
    const rival = createCompetitorSession(doorDashCandidates[0]!, "uber-eats", 300000, 0, 60000);
    rival.runs = [makeRun({ mode: "public_video", started_at: now.toISOString() })];
    expect(analysesToday([own, rival], now)).toBe(3);
    expect(analysesToday([own, rival], now, "tracker")).toBe(2);
    expect(analysesToday([own, rival], now, "explorer")).toBe(1);
    const settings = sanitizeAgentSettings({ tracker: { max_analyses_per_day: 2 } });
    const cap = usageCapStatus([own, rival], settings, "tracker", now);
    expect(cap).toMatchObject({ used: 2, max: 2, remaining: 0, blocked: true });
    expect(checkUsageCap(rival, [own, rival], settings, now).blocked).toBe(false);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(analyzeSession(own, "events_only", vi.fn(), { usage: cap })).rejects.toThrow(
      "cap of 2",
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(splitByConfidence([{ confidence: 0.2 }, { confidence: 0.9 }], 0.5).hidden).toHaveLength(
      1,
    );
  });
  it("persists through the SSR-safe hook", () => {
    const { result } = renderHook(() => useAgentSettings());
    act(() => result.current.updateScout("tracker", { focus_areas: ["copy"] }));
    expect(result.current.settings.tracker.focus_areas).toEqual(["copy"]);
    expect(JSON.parse(localStorage.getItem(AGENT_SETTINGS_KEY)!).tracker.focus_areas).toEqual([
      "copy",
    ]);
    act(() => result.current.reset());
    expect(result.current.settings).toEqual(defaultAgentSettings);
  });
  it("shows the in-memory settings when a storage write fails", () => {
    const { result } = renderHook(() => useAgentSettings());
    act(() => result.current.updateScout("tracker", { max_analyses_per_day: 3 }));
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    try {
      act(() => result.current.updateScout("tracker", { max_analyses_per_day: 7 }));
      expect(result.current.settings.tracker.max_analyses_per_day).toBe(7);
    } finally {
      setItem.mockRestore();
      act(() => result.current.reset());
    }
  });
});

describe("simulated demo loop", () => {
  it("advances stages by elapsed time and reveals deltas and PR only when due", () => {
    const run = {
      kind: "experiment" as const,
      started_at: new Date(0).toISOString(),
      duration_ms: EXPERIMENT_DURATION_MS,
    };
    expect(runStage(run, 0)).toMatchObject({
      label: "Designing test",
      deltasVisible: false,
      prReady: false,
    });
    expect(runStage(run, 12000).label).toBe("Collecting variant recordings (20% traffic)");
    expect(runStage(run, 29000)).toMatchObject({ label: "Comparing deltas", deltasVisible: true });
    expect(runStage(run, 40000)).toMatchObject({ label: "PR ready", done: true, prReady: true });
    const fix = { kind: "fix" as const, started_at: new Date(0).toISOString(), duration_ms: 20000 };
    expect(runStage(fix, 8000).label).toBe("Verifying on recordings");
  });
  it("derives deterministic, labeled illustrative deltas", () => {
    const a = illustrativeDeltas("experiment", test);
    expect(a).toEqual(illustrativeDeltas("experiment", test));
    expect(a.every((d) => d.illustrative)).toBe(true);
    expect(a.map((d) => d.metric)).toEqual([
      "Median time on step",
      "Missed or repeated taps per session",
      "Task completion",
    ]);
  });
  it("stores runs under their own key, idempotently, with no network", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const finding = makeFinding({ suggested_test: test, suggested_route: "experiment" });
    const now = new Date();
    const run = startSimulatedRun(finding, "experiment", { product_id: "checkout", now });
    expect(run).toMatchObject({
      simulated: true,
      scout: "experimenter",
      kind: "experiment",
      traffic_percent: 20,
      finding_id: finding.id,
    });
    expect(startSimulatedRun(finding, "experiment", { product_id: "checkout" }).id).toBe(run.id);
    expect(JSON.parse(localStorage.getItem(SIMULATION_KEY)!).runs).toHaveLength(1);
    expect(() => mergePr(run.id, now.getTime())).toThrow("not ready");
    expect(mergePr(run.id, now.getTime() + EXPERIMENT_DURATION_MS).pr.status).toBe("merged");
    expect(closePr(run.id).pr.status).toBe("closed");
    const fix = startSimulatedRun(makeFinding({ recommendation: "Make it bigger" }), "fix", {
      product_id: "checkout",
    });
    expect(fix).toMatchObject({ scout: "fixer", test: { change: "Make it bigger" } });
    expect(fetcher).not.toHaveBeenCalled();
    resetSimulatedDemo();
    expect(listSimulatedRuns()).toEqual([]);
  });
  it("marks competitor-derived runs as Explorer ideas and drops runs for a deleted session", () => {
    const rival = createCompetitorSession(doorDashCandidates[0]!, "uber-eats", 300000, 0, 60000);
    expect(ideaSourceFor(rival)).toMatchObject({ scout: "explorer" });
    expect(ideaSourceFor(makeSession())).toBeUndefined();
    const finding = makeFinding({ session_id: rival.id, suggested_test: test });
    const run = startSimulatedRun(finding, "experiment", {
      product_id: "uber-eats",
      idea_source: ideaSourceFor(rival),
    });
    expect(run.idea_source?.scout).toBe("explorer");
    discardRunsForSession(rival.id);
    expect(listSimulatedRuns()).toEqual([]);
  });
  it("keeps new runs in memory when a storage write fails", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setItem.mockRestore();
    startSimulatedRun(makeFinding({ suggested_test: test }), "experiment", {
      product_id: "checkout",
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    try {
      startSimulatedRun(makeFinding({ suggested_test: test }), "experiment", {
        product_id: "checkout",
      });
      expect(listSimulatedRuns()).toHaveLength(2);
    } finally {
      vi.restoreAllMocks();
      resetSimulatedDemo();
    }
  });
  it("seeds completed labeled samples that never duplicate the Order again demo test", () => {
    const samples = seedSampleLoop("uber-eats");
    expect(samples.map((s) => s.kind).sort()).toEqual(["experiment", "fix"]);
    const experiment = samples.find((s) => s.kind === "experiment")!;
    expect(experiment.test.change).not.toContain("Order again");
    expect(experiment.test.change).toContain("20% of traffic");
    expect(experiment.idea_source).toEqual({
      scout: "explorer",
      label: "DoorDash public footage (sample)",
    });
    expect(
      samples.every((s) => s.sample && s.simulated && runStage(s).done && s.finding_id === null),
    ).toBe(true);
    expect(seedSampleLoop("uber-eats").map((s) => s.id)).toEqual(samples.map((s) => s.id));
    expect(seedSampleLoop("checkout")).toHaveLength(2);
  });
  it("ticks while a run is active and clears its timer when done or unmounted", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useSimulation());
    expect(result.current.runs).toEqual([]);
    act(() => {
      result.current.start(makeFinding({ suggested_test: test }), "fix", {
        product_id: "checkout",
      });
    });
    expect(result.current.stageOf(result.current.runs[0]!).label).toBe("Building fix");
    act(() => vi.advanceTimersByTime(8000));
    expect(result.current.stageOf(result.current.runs[0]!).label).toBe("Verifying on recordings");
    act(() => vi.advanceTimersByTime(13000));
    expect(result.current.stageOf(result.current.runs[0]!).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("re-reads the clock when runs change after sitting idle", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSimulation());
      const before = result.current.now;
      act(() => vi.advanceTimersByTime(60_000));
      expect(result.current.now).toBe(before);
      act(() => {
        result.current.seed("uber-eats");
      });
      expect(result.current.now).toBeGreaterThanOrEqual(before + 60_000);
    } finally {
      vi.useRealTimers();
      resetSimulatedDemo();
    }
  });
});

describe("competitor sessions stay out of own-product metrics", () => {
  it("maps Uber Eats to DoorDash and excludes competitor footage from priorities, products and evaluation", () => {
    expect(competitorOf("uber-eats")?.name).toBe("DoorDash");
    expect(competitorOf("checkout")).toBeNull();
    const rival = createCompetitorSession(doorDashCandidates[1]!, "uber-eats", 300000, 0, 60000);
    const run = makeRun({ mode: "video_frames_plus_events" });
    // Even if competitor footage somehow carried own-product-shaped runs, it must not count.
    const disguised = {
      ...rival,
      capture_mode: "browser_tab",
      runs: [run],
      findings: [makeFinding({ analysis_run_id: run.id })],
      issues: [
        {
          id: "issue",
          category: "long_loading",
          screen: "item_details",
          actually_observed: "yes" as const,
        },
      ],
    };
    expect(isCompetitorSession(disguised)).toBe(true);
    expect(aggregateInsights([disguised])).toEqual([]);
    expect(score([disguised]).eligibleSessions).toBe(0);
    expect(sessionsForProduct([rival], "uber-eats")).toEqual([]);
    expect(competitorSessionsFor([rival, makeSession()], "uber-eats")).toEqual([rival]);
    expect(competitorSessionsFor([rival], "checkout")).toEqual([]);
    expect(aggregateInsights([makeSession()])).toHaveLength(1);
  });
});
