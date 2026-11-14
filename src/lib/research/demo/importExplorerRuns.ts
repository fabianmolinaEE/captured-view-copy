import explorerRuns from "./doordash-explorer-runs.json";
import { pregeneratedLabel } from "../publicVideo";
import { createCompetitorSession, doorDashCandidates, DOORDASH_SOURCE } from "../competitors";
import type { ProductId } from "../products";
import { getSession, saveSession } from "../sessionStorage";
import type { AnalysisRun, Finding, Session } from "../types";
import {
  describeImport,
  importTrackerRuns,
  notifySessionsChanged,
  type TrackerImportResult,
} from "./importTrackerRuns";

/**
 * Imports the real, pre-generated DoorDash Explorer runs (Gemini output on four public DoorDash
 * YouTube walkthroughs, analyzed as competitor footage for Uber Eats) into this browser's
 * IndexedDB, the same way the Uber Eats Tracker runs are imported. The JSON holds only
 * public-video metadata and model output: no secrets, no interaction events, no planted
 * scenarios and no ground truth.
 *
 * Rules: model text is never altered; an existing session with the same id is never overwritten
 * (reviewer decisions, notes and edits survive); imported runs are marked `pregenerated` and are
 * exempt from the daily analysis cap. Competitor sessions stay out of own-product Insights,
 * counts and Evaluation (see competitors.ts).
 */
export const EXPLORER_RUNS_SOURCE = "doordash-explorer-runs" as const;
/** localStorage key recording that this browser already ran the automatic Explorer import. */
export const EXPLORER_IMPORT_KEY = "loopmate-demo-import-explorer";
const EXPLORER_IMPORT_VERSION = "doordash-explorer-runs@2026-11-13";

interface ExplorerVideo {
  candidate_id: string;
  session_id: string;
  source: string;
  competitor_of: ProductId;
  title: string;
  duration_ms: number;
  clip: { start_ms: number; end_ms: number };
  clip_rationale?: string;
  run: AnalysisRun;
  findings: Finding[];
}
interface ExplorerRunsFile {
  generated_at: string;
  model_name: string;
  scout: "explorer";
  competitor_of: ProductId;
  source: string;
  note: string;
  videos: ExplorerVideo[];
}
const file = explorerRuns as unknown as ExplorerRunsFile;
/** Model output is plain JSON; a deep copy keeps the bundled original untouched. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export type ExplorerImportResult = TrackerImportResult;

/** Builds one competitor session from the file. Throws on any inconsistency rather than repairing it. */
export function buildExplorerSession(video: ExplorerVideo, now = new Date()): Session {
  const candidate = doorDashCandidates.find((c) => c.id === video.candidate_id);
  if (!candidate) throw new Error(`Unknown DoorDash candidate ${video.candidate_id}.`);
  if (
    file.source !== DOORDASH_SOURCE ||
    video.source !== DOORDASH_SOURCE ||
    video.competitor_of !== file.competitor_of
  )
    throw new Error("Explorer run provenance does not match DoorDash competitor footage.");
  if (video.run.mode !== "public_video" || video.run.status !== "completed")
    throw new Error("Only completed public-video runs can be imported.");
  if (
    video.findings.some(
      (f) => f.session_id !== video.session_id || f.analysis_run_id !== video.run.id,
    )
  )
    throw new Error("A finding does not belong to this session's run.");
  const base = createCompetitorSession(
    candidate,
    video.competitor_of,
    video.duration_ms,
    video.clip.start_ms,
    video.clip.end_ms,
  );
  return {
    ...base,
    id: video.session_id,
    // Stable ordering and honest dating: the session dates from its generated run.
    created_at: video.run.started_at,
    captured_at: video.run.started_at,
    runs: [clone(video.run)],
    findings: clone(video.findings),
    status: "analyzed",
    pregenerated: {
      source: EXPLORER_RUNS_SOURCE,
      generated_at: file.generated_at,
      note: file.note,
      run_ids: [video.run.id],
      imported_at: now.toISOString(),
    },
  };
}

export const explorerRunsFile = (): Readonly<ExplorerRunsFile> => file;

let inFlight: Promise<ExplorerImportResult> | null = null;
/** Idempotent: adds only sessions whose id is not already stored. Concurrent calls share one run. */
export function importExplorerRuns(): Promise<ExplorerImportResult> {
  inFlight ??= (async () => {
    const result: ExplorerImportResult = { added: [], skipped: [], failed: [], findings_added: 0 };
    for (const video of file.videos) {
      try {
        if (await getSession(video.session_id)) {
          result.skipped.push(video.session_id);
          continue;
        }
        const session = buildExplorerSession(video);
        await saveSession(session);
        result.added.push(session.id);
        result.findings_added += session.findings.length;
      } catch (e) {
        result.failed.push({
          session_id: video.session_id,
          error: e instanceof Error ? e.message : "Import failed.",
        });
      }
    }
    if (result.added.length) notifySessionsChanged(result.added);
    return result;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function importAlreadyRan() {
  try {
    return window.localStorage.getItem(EXPLORER_IMPORT_KEY) === EXPLORER_IMPORT_VERSION;
  } catch {
    return false;
  }
}
function markImportRan() {
  try {
    window.localStorage.setItem(EXPLORER_IMPORT_KEY, EXPLORER_IMPORT_VERSION);
  } catch {
    /* Without storage the idempotent import simply runs again next load. */
  }
}
async function anyExplorerSessionStored() {
  for (const video of file.videos) {
    try {
      if (await getSession(video.session_id)) return true;
    } catch {
      return false;
    }
  }
  return false;
}
let autoRun: Promise<ExplorerImportResult | null> | null = null;
/**
 * Runs the import once per browser (per data version), with its own version key so it also runs
 * in browsers that already imported the Tracker runs. Deleted sessions are not re-added
 * automatically while at least one Explorer session remains; Settings → Re-import adds them.
 */
export function autoImportExplorerRuns(): Promise<ExplorerImportResult | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined")
    return Promise.resolve(null);
  autoRun ??= (async () => {
    if (importAlreadyRan() && (await anyExplorerSessionStored())) return null;
    const result = await importExplorerRuns();
    if (!result.failed.length) markImportRan();
    return result;
  })();
  return autoRun;
}
/** Test-only: resets the per-page auto-import guard. */
export function resetExplorerAutoImportForTests() {
  autoRun = null;
}

export function describeExplorerImport(result: ExplorerImportResult) {
  const parts = [
    result.added.length
      ? `Added ${result.added.length} DoorDash Explorer ${result.added.length === 1 ? "run" : "runs"} (${result.findings_added} competitor ${result.findings_added === 1 ? "insight" : "insights"}).`
      : "No Explorer runs were missing; nothing was changed.",
  ];
  if (result.added.length && result.skipped.length)
    parts.push(`${result.skipped.length} already present and left unchanged.`);
  if (result.failed.length)
    parts.push(`${result.failed.length} could not be imported: ${result.failed[0]!.error}`);
  return parts.join(" ");
}

/**
 * Scout-aware label for an imported pre-generated run: an alias of publicVideo's
 * `pregeneratedLabel`, so every page decides "Explorer" vs "Tracker" the same way.
 */
export const pregeneratedRunLabel = (session: Parameters<typeof pregeneratedLabel>[0]) =>
  pregeneratedLabel(session);

/** Settings → Re-import: adds any missing Tracker and Explorer runs; never overwrites. */
export async function reimportAllDemoRuns() {
  const [tracker, explorer] = await Promise.all([importTrackerRuns(), importExplorerRuns()]);
  return {
    tracker,
    explorer,
    message: `${describeImport(tracker)} ${describeExplorerImport(explorer)}`,
  };
}
