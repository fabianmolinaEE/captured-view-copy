import { useEffect, useState, useSyncExternalStore } from "react";
import type { SuggestedTest } from "@/lib/research/types";
import {
  SIMULATION_CHANGE_EVENT,
  SIMULATION_KEY,
  closePr,
  discardRunsForFinding,
  mergePr,
  happyPathRun,
  parseSimulationStore,
  readSimulatedRaw,
  approveSampleTest,
  fastForwardRun,
  rejectSampleTest,
  resetSampleTest,
  sampleDecisionOf,
  saveSampleTestDraft,
  startSampleTestRun,
  type SimulationStore,
  resetSimulatedDemo,
  runStage,
  seedSampleLoop,
  startSimulatedRun,
  type SimulatedRun,
} from "@/lib/research/simulation";

const emptyStore: SimulationStore = { runs: [], samples: {} };
let cache: { raw: string | null; store: SimulationStore } | null = null;
function snapshot(): SimulationStore {
  const raw = readSimulatedRaw();
  if (!cache || cache.raw !== raw)
    cache = { raw, store: raw ? parseSimulationStore(raw) : emptyStore };
  return cache.store;
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === SIMULATION_KEY || event.key === null) notify();
  };
  window.addEventListener(SIMULATION_CHANGE_EVENT, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(SIMULATION_CHANGE_EVENT, notify);
    window.removeEventListener("storage", storage);
  };
}
/**
 * Simulated demo runs (always badged "Simulated demo") plus a clock that ticks every second
 * while any run is still in progress, so stages advance. The clock is also re-read whenever the
 * runs change (for example "Load sample loop" after the page sat idle), so newly added activity
 * is never hidden behind a stale clock. The interval is cleared when every run is finished or
 * the component unmounts. SSR-safe: the server renders no runs.
 */
export function useSimulation(tickMs = 1000) {
  const store = useSyncExternalStore(subscribe, snapshot, () => emptyStore);
  const runs = store.runs;
  const [now, setNow] = useState(() => Date.now());
  const active = runs.some((run) => !runStage(run, now).done);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [active, tickMs, runs]);
  return {
    runs,
    now,
    stageOf: (run: SimulatedRun) => runStage(run, now),
    start: startSimulatedRun,
    mergePr: (id: string) => mergePr(id, Date.now()),
    closePr: (id: string) => closePr(id, Date.now()),
    discardForFinding: discardRunsForFinding,
    reset: resetSimulatedDemo,
    seed: seedSampleLoop,
    /** Decision on the fictional "Order again" sample insight (pending by default). */
    sampleDecision: sampleDecisionOf(store),
    /** The happy-path run for the sample insight, if started. */
    happyPathRun: happyPathRun(runs),
    /** Approves the sample test and starts its run (optionally with the reviewer's edits). */
    approveSample: (test?: SuggestedTest) => startSampleTestRun(new Date(), test),
    /** Approval only, no run (Experimenter off). Keeps the reviewer's edits. */
    approveSampleOnly: (test?: SuggestedTest) => approveSampleTest(new Date(), test),
    /** Saves (or clears, with undefined) the reviewer's edits to the sample test. */
    saveSampleDraft: (test: SuggestedTest | undefined) => saveSampleTestDraft(test),
    /** Demo control: jump a run to PR ready. */
    fastForward: (id: string) => fastForwardRun(id),
    rejectSample: rejectSampleTest,
    resetSample: resetSampleTest,
  };
}
