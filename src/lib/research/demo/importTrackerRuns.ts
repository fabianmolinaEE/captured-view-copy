import trackerRuns from "./uber-eats-tracker-runs.json";
import { createPublicSession, uberEatsCandidates } from "../publicVideo";
import { deleteSession, getSession, listSessions, saveSession } from "../sessionStorage";
import { discardRunsForFinding, discardRunsForSession } from "../simulation";
import type { AnalysisRun, Finding, Session } from "../types";

/**
 * Imports the real, pre-generated Uber Eats Tracker run (Gemini output on a public YouTube
 * walkthrough) into this browser's IndexedDB so Insights and Recordings show it without anyone
 * clicking Analyze. The JSON holds only public-video metadata and model output: no secrets, no
 * interaction events, no planted scenarios and no ground truth.
 *
 * Curation (user request, Nov 13): the demo shows only three insights, so the bundle keeps one
 * video and one finding ("Hidden minimum order threshold"). The kept run, including its
 * `raw_output`, is verbatim; `raw_output` still holds the model's complete original answer. See
 * the file's top-level `curation` note. `applyCuration` brings browsers that imported the older,
 * larger bundle in line, touching only sessions that carry this bundle's `pregenerated` marker.
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
const DEMO_IMPORT_VERSION = "uber-eats-tracker-runs@2026-11-13-curated";

/** Top-level note in each bundled file explaining which model findings the demo displays. */
export interface DemoCuration {
  curated_at: string;
  reason: string;
  kept_session_ids: string[];
  kept_finding_ids: string[];
  kept_finding_titles: string[];
  removed_from_display: string;
}

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
  curation: DemoCuration;
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
  /** Older pre-generated sessions removed because they are outside the curated demo set. */
  pruned: string[];
  /** Stored curated sessions whose non-curated pre-generated findings were removed. */
  curated: string[];
  /** Pre-generated sessions outside the set kept because they also hold the user's own runs. */
  kept_user_runs: string[];
}
const emptyResult = (): TrackerImportResult => ({
  added: [],
  skipped: [],
  failed: [],
  findings_added: 0,
  pruned: [],
  curated: [],
  kept_user_runs: [],
});

/** The part of a bundled video that curation needs. */
export interface CuratedVideo {
  session_id: string;
  findings: Finding[];
}
/**
 * Migration for browsers that imported an older, larger bundle. Idempotent. Touches ONLY sessions
 * whose `pregenerated.source` is `source`; user recordings and analyses are never read for change.
 *
 * - A marked session outside `videos` is deleted (with its simulated runs), unless it also holds
 *   runs that are not in `pregenerated.run_ids` (the user's own later analyses); then it is left
 *   untouched and reported in `kept_user_runs`.
 * - A marked session in `videos` keeps only the curated findings from the pre-generated run.
 *   A kept finding stays exactly as stored (model text plus any review, note or test decision);
 *   findings from the user's own later runs stay. Runs (and `raw_output`) are never changed.
 */
export async function applyCuration(
  source: NonNullable<Session["pregenerated"]>["source"],
  videos: readonly CuratedVideo[],
  result: Pick<TrackerImportResult, "pruned" | "curated" | "kept_user_runs"> = emptyResult(),
) {
  const curated = new Map(videos.map((video) => [video.session_id, video]));
  for (const listed of await listSessions()) {
    if (listed.pregenerated?.source !== source) continue;
    // Re-read just before changing it, so a reviewer save made since the listing is not lost.
    const session = await getSession(listed.id);
    const marker = session?.pregenerated;
    if (!session || marker?.source !== source) continue;
    const pregeneratedRuns = new Set(marker.run_ids);
    const video = curated.get(session.id);
    if (!video) {
      if (session.runs.some((run) => !pregeneratedRuns.has(run.id))) {
        result.kept_user_runs.push(session.id);
        continue;
      }
      await deleteSession(session.id);
      discardRunsForSession(session.id);
      result.pruned.push(session.id);
      continue;
    }
    const keep = new Set(video.findings.map((finding) => finding.id));
    const removed = session.findings.filter(
      (finding) => pregeneratedRuns.has(finding.analysis_run_id) && !keep.has(finding.id),
    );
    const stored = new Set(session.findings.map((finding) => finding.id));
    const missing = video.findings.filter((finding) => !stored.has(finding.id));
    if (!removed.length && !missing.length) continue;
    const removedIds = new Set(removed.map((finding) => finding.id));
    await saveSession({
      ...session,
      findings: [
        ...session.findings.filter((finding) => !removedIds.has(finding.id)),
        ...clone(missing),
      ],
      matches: session.matches.filter((match) => !removedIds.has(match.finding_id)),
    });
    for (const id of removedIds) discardRunsForFinding(id);
    result.curated.push(session.id);
  }
  return result;
}

/**
 * A page can still hold a copy of a pre-generated session that it loaded before `applyCuration`
 * ran. Returns that copy without the pre-generated findings storage no longer holds, so saving it
 * cannot bring them back. Everything else in the local copy (reviews, notes, the user's own runs
 * and their findings) is kept. Sessions without the `pregenerated` marker pass through unchanged.
 */
export function reconcileWithCuration(local: Session, stored: Session): Session {
  if (!local.pregenerated) return local;
  const runs = new Set([...local.pregenerated.run_ids, ...(stored.pregenerated?.run_ids ?? [])]);
  const storedIds = new Set(stored.findings.map((finding) => finding.id));
  const dropped = new Set(
    local.findings
      .filter((finding) => runs.has(finding.analysis_run_id) && !storedIds.has(finding.id))
      .map((finding) => finding.id),
  );
  if (!dropped.size) return local;
  return {
    ...local,
    findings: local.findings.filter((finding) => !dropped.has(finding.id)),
    matches: local.matches.filter((match) => !dropped.has(match.finding_id)),
  };
}

/** Thrown instead of saving a stale copy of a pre-generated session the curation deleted. */
export class RemovedDemoSessionError extends Error {
  constructor() {
    super("This sample recording was removed from the curated demo, so the change was not saved.");
    this.name = "RemovedDemoSessionError";
  }
}

/**
 * The copy of `local` that is safe to save. For a pre-generated session it re-reads storage:
 * throws `RemovedDemoSessionError` when the curation deleted the session (saving would revive
 * it) and otherwise drops findings the curation removed. Other sessions are returned as-is.
 */
export async function curatedCopyToSave(local: Session): Promise<Session> {
  if (!local.pregenerated) return local;
  const stored = await getSession(local.id);
  if (!stored) throw new RemovedDemoSessionError();
  return reconcileWithCuration(local, stored);
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

/** `added` lists every session id that was added, changed or removed. */
export function notifySessionsChanged(added: string[] = []) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSIONS_CHANGED_EVENT, { detail: { added } }));
}

let inFlight: Promise<TrackerImportResult> | null = null;
/**
 * Idempotent: applies the curation, then adds only sessions whose id is not already stored.
 * Concurrent calls share one run.
 */
export function importTrackerRuns(): Promise<TrackerImportResult> {
  inFlight ??= (async () => {
    const result = emptyResult();
    await applyCuration(TRACKER_RUNS_SOURCE, file.videos, result);
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
    const changed = [...result.added, ...result.curated, ...result.pruned];
    if (changed.length) notifySessionsChanged(changed);
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
/**
 * The localStorage flag lives apart from IndexedDB; a wiped database must not stay empty. True
 * when any bundled session, or failing that any session at all, is stored: with a single curated
 * session, deleting it must not count as a wipe while other recordings remain.
 */
export async function demoSessionsOrOthersStored(videos: readonly { session_id: string }[]) {
  try {
    for (const video of videos) if (await getSession(video.session_id)) return true;
    return (await listSessions()).length > 0;
  } catch {
    return false;
  }
}
let autoRun: Promise<TrackerImportResult | null> | null = null;
/**
 * Runs the import (with the curation migration) once per browser per data version; bumping the
 * version re-runs it where an older bundle was imported. After a successful run, a deleted
 * Tracker session is not re-added automatically while any session remains (Settings → Re-import
 * adds it); if the database is empty (for example IndexedDB was wiped while localStorage
 * survived), the import runs again.
 */
export function autoImportTrackerRuns(): Promise<TrackerImportResult | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined")
    return Promise.resolve(null);
  autoRun ??= (async () => {
    if (importAlreadyRan() && (await demoSessionsOrOthersStored(file.videos))) return null;
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

/** Sentence about curation changes, or "" when there were none. */
export function describeCuration(result: TrackerImportResult, scout: "Tracker" | "Explorer") {
  const parts: string[] = [];
  if (result.pruned.length)
    parts.push(
      `Removed ${result.pruned.length} older ${scout} ${result.pruned.length === 1 ? "run" : "runs"} outside the curated demo set.`,
    );
  if (result.curated.length)
    parts.push(
      `Trimmed ${result.curated.length} ${scout} ${result.curated.length === 1 ? "run" : "runs"} to the curated ${result.curated.length === 1 ? "insight" : "insights"}.`,
    );
  if (result.kept_user_runs.length)
    parts.push(
      `${result.kept_user_runs.length} ${scout} ${result.kept_user_runs.length === 1 ? "session" : "sessions"} with your own analyses left unchanged.`,
    );
  return parts.join(" ");
}
const changedAnything = (result: TrackerImportResult) =>
  result.added.length + result.pruned.length + result.curated.length > 0;

export function describeImport(result: TrackerImportResult) {
  const parts = [
    result.added.length
      ? `Added ${result.added.length} Uber Eats Tracker ${result.added.length === 1 ? "run" : "runs"} (${result.findings_added} ${result.findings_added === 1 ? "insight" : "insights"}).`
      : changedAnything(result)
        ? "No Tracker runs were missing."
        : "No Tracker runs were missing; nothing was changed.",
  ];
  const curation = describeCuration(result, "Tracker");
  if (curation) parts.push(curation);
  if (result.added.length && result.skipped.length)
    parts.push(`${result.skipped.length} already present and left unchanged.`);
  if (result.failed.length)
    parts.push(`${result.failed.length} could not be imported: ${result.failed[0]!.error}`);
  return parts.join(" ");
}
