import trackerRuns from "./uber-eats-tracker-runs.json";
import { createPublicSession, uberEatsCandidates } from "../publicVideo";
import { getSession, saveSession } from "../sessionStorage";
import type { AnalysisRun, Finding, Session } from "../types";

/**
 * Imports the real, pre-generated Uber Eats Tracker runs (Gemini output on five public YouTube
 * walkthroughs) into this browser's IndexedDB so Insights and Recordings show them without anyone
 * clicking Analyze. The JSON holds only public-video metadata and model output: no secrets, no
 * interaction events, no planted scenarios and no ground truth.
 *
 * Rules: model text is never altered; an existing session with the same id is never overwritten
 * (so reviewer decisions, notes and edits survive); imported runs are marked `pregenerated` and
 * are exempt from the daily analysis cap.
 */
export const TRACKER_RUNS_SOURCE = "uber-eats-tracker-runs" as const;
/** Window event dispatched after sessions are added outside a page's own load. */
export const SESSIONS_CHANGED_EVENT = "loopmate-sessions-changed";
/** localStorage key recording that this browser already ran the automatic import. */
export const DEMO_IMPORT_KEY = "loopmate-demo-import";
const DEMO_IMPORT_VERSION = "uber-eats-tracker-runs@2026-11-13";

interface TrackerVideo {
  candidate_id: string;
  session_id: string;
  title: string;
  duration_ms: number;
  clip: { start_ms: number; end_ms: number };
  clip_rationale?: string;
  run: AnalysisRun;
  findings: Finding[];
}
interface TrackerRunsFile {
  generated_at: string;
  model_name: string;
  note: string;
  videos: TrackerVideo[];
}
const file = trackerRuns as unknown as TrackerRunsFile;
/** Model output is plain JSON; a deep copy keeps the bundled original untouched. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface TrackerImportResult {
  added: string[];
  skipped: string[];
  failed: { session_id: string; error: string }[];
  findings_added: number;
}

/** Builds one session from the file. Throws on any inconsistency rather than repairing it. */
export function buildTrackerSession(video: TrackerVideo, now = new Date()): Session {
  const candidate = uberEatsCandidates.find((c) => c.id === video.candidate_id);
  if (!candidate) throw new Error(`Unknown public candidate ${video.candidate_id}.`);
  if (video.run.mode !== "public_video" || video.run.status !== "completed")
    throw new Error("Only completed public-video runs can be imported.");
  if (
    video.findings.some(
      (f) => f.session_id !== video.session_id || f.analysis_run_id !== video.run.id,
    )
  )
    throw new Error("A finding does not belong to this session's run.");
  const base = createPublicSession(
    candidate,
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
      source: TRACKER_RUNS_SOURCE,
      generated_at: file.generated_at,
      note: file.note,
      run_ids: [video.run.id],
      imported_at: now.toISOString(),
    },
  };
}

export const trackerRunsFile = (): Readonly<TrackerRunsFile> => file;

export function notifySessionsChanged(added: string[] = []) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSIONS_CHANGED_EVENT, { detail: { added } }));
}

let inFlight: Promise<TrackerImportResult> | null = null;
/** Idempotent: adds only sessions whose id is not already stored. Concurrent calls share one run. */
export function importTrackerRuns(): Promise<TrackerImportResult> {
  inFlight ??= (async () => {
    const result: TrackerImportResult = { added: [], skipped: [], failed: [], findings_added: 0 };
    for (const video of file.videos) {
      try {
        if (await getSession(video.session_id)) {
          result.skipped.push(video.session_id);
          continue;
        }
        const session = buildTrackerSession(video);
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
    return window.localStorage.getItem(DEMO_IMPORT_KEY) === DEMO_IMPORT_VERSION;
  } catch {
    return false;
  }
}
function markImportRan() {
  try {
    window.localStorage.setItem(DEMO_IMPORT_KEY, DEMO_IMPORT_VERSION);
  } catch {
    /* Without storage the idempotent import simply runs again next load. */
  }
}
/** The localStorage flag lives apart from IndexedDB; a wiped database must not stay empty. */
async function anyTrackerSessionStored() {
  for (const video of file.videos) {
    try {
      if (await getSession(video.session_id)) return true;
    } catch {
      return false;
    }
  }
  return false;
}
let autoRun: Promise<TrackerImportResult | null> | null = null;
/**
 * Runs the import once per browser (per data version). After a successful run, sessions the
 * user deletes are not re-added automatically while at least one Tracker session remains
 * (Settings → Re-import adds missing ones); if none remain (for example the IndexedDB database
 * was wiped while localStorage survived), the import runs again.
 */
export function autoImportTrackerRuns(): Promise<TrackerImportResult | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined")
    return Promise.resolve(null);
  autoRun ??= (async () => {
    if (importAlreadyRan() && (await anyTrackerSessionStored())) return null;
    const result = await importTrackerRuns();
    if (!result.failed.length) markImportRan();
    return result;
  })();
  return autoRun;
}
/** Test-only: resets the per-page auto-import guard. */
export function resetAutoImportForTests() {
  autoRun = null;
}

export function describeImport(result: TrackerImportResult) {
  const parts = [
    result.added.length
      ? `Added ${result.added.length} Uber Eats Tracker ${result.added.length === 1 ? "run" : "runs"} (${result.findings_added} ${result.findings_added === 1 ? "insight" : "insights"}).`
      : "No Tracker runs were missing; nothing was changed.",
  ];
  if (result.added.length && result.skipped.length)
    parts.push(`${result.skipped.length} already present and left unchanged.`);
  if (result.failed.length)
    parts.push(`${result.failed.length} could not be imported: ${result.failed[0]!.error}`);
  return parts.join(" ");
}
