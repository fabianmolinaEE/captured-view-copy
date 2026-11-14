import { isPublicVideo } from "./publicVideo";
import { blindPayload } from "./aiReview";
import { isCompetitorSession } from "./competitors";
import {
  scoutForSession,
  usageCapStatus,
  type AgentSettings,
  type UsageCapStatus,
} from "./agentSettings";
import { extractFrames } from "./frameSampler";
import { getSampling } from "./sessionStorage";
import type { Session, AnalysisMode, AnalysisRun, Finding, AgentFocus } from "./types";
export interface ConnectionStatus {
  configured: boolean;
  model: string;
  backend_configured: boolean;
  access_required: boolean;
  message: string;
}
export const accessCode = () => sessionStorage.getItem("research-access") ?? "";
export function saveAccessCode(code: string) {
  if (code) sessionStorage.setItem("research-access", code);
  else sessionStorage.removeItem("research-access");
}
export async function researchFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/research/${path}`, {
    ...init,
    headers: {
      ...(accessCode() ? { Authorization: `Bearer ${accessCode()}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: `Request failed (${response.status}).` }));
    throw new Error(body.error ?? `Request failed (${response.status}).`);
  }
  return response;
}
export const connectionStatus = async (): Promise<ConnectionStatus> =>
  (await researchFetch("status")).json();
const inflight = new Set<string>();
/**
 * Usage cap for the manual Analyze action, counted from stored real runs today for the scout
 * that analyzes this session (Tracker for own product, Explorer for competitor footage).
 */
export function checkUsageCap(
  session: Session,
  allSessions: Session[],
  settings: AgentSettings,
  now: Date = new Date(),
): UsageCapStatus {
  return usageCapStatus(allSessions, settings, scoutForSession(session), now);
}
/** Focus areas from the scout that analyzes this session. */
export function analysisOptionsFor(session: Session, settings: AgentSettings): AnalyzeOptions {
  return { focus_areas: settings[scoutForSession(session)].focus_areas };
}
export interface AnalyzeOptions {
  /** Allow-listed emphasis lenses (validated again server-side). */
  focus_areas?: readonly AgentFocus[] | undefined;
  /** When given, the request is refused client-side if the cap is reached. */
  usage?: UsageCapStatus | undefined;
}
/** A failure raised before any analysis request was sent; it never counts toward the daily cap. */
export class AnalysisNotSentError extends Error {
  override name = "AnalysisNotSentError";
}
export async function analyzeSession(
  session: Session,
  mode: AnalysisMode,
  progress: (message: string) => void,
  options: AnalyzeOptions = {},
): Promise<{ run: AnalysisRun; findings: Finding[] }> {
  if (inflight.has(session.id))
    throw new AnalysisNotSentError("Analysis is already running for this session.");
  if (options.usage?.blocked) throw new AnalysisNotSentError(options.usage.reason);
  if (!session.consent_confirmed)
    throw new AnalysisNotSentError("A consented test session is required.");
  if (mode === "video_frames_plus_events" && !session.capture_region)
    throw new AnalysisNotSentError(
      "Record a new session with a checkout crop before multimodal analysis. This older recording may show researcher answers outside the checkout.",
    );
  if (isPublicVideo(session) && mode !== "public_video")
    throw new AnalysisNotSentError(
      "This recording uses video analysis; no interaction logs are attached.",
    );
  if (
    mode === "public_video" &&
    (!isPublicVideo(session) ||
      !session.public_video?.duration_verified ||
      !session.public_video.footage_reviewed_at)
  )
    throw new AnalysisNotSentError(
      "Preview and review the selected recording segment before analysis.",
    );
  inflight.add(session.id);
  try {
    progress(
      mode === "public_video"
        ? "Preparing the public video segment…"
        : mode === "events_only"
          ? "Preparing events-only input…"
          : "Extracting checkout video frames…",
    );
    let frames: Awaited<ReturnType<typeof extractFrames>> = [];
    if (mode === "video_frames_plus_events") {
      try {
        frames = await extractFrames(
          session.video_blob,
          session.duration_ms,
          session.events,
          await getSampling(),
          session.video_start_offset_ms,
          session.capture_region,
          session.capture_region_valid_from_ms ?? 0,
        );
      } catch (error) {
        throw new AnalysisNotSentError(
          error instanceof Error ? error.message : "Frames could not be extracted.",
        );
      }
    }
    progress(
      mode === "public_video"
        ? isCompetitorSession(session)
          ? "Waiting for Gemini · Competitor video segment…"
          : "Waiting for Gemini · Direct public video segment…"
        : `Waiting for Gemini · ${frames.length} frames · ${session.events.length} events…`,
    );
    return await (
      await researchFetch("analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          run_id: crypto.randomUUID(),
          ...blindPayload(session, frames, mode, { focus_areas: options.focus_areas }),
        }),
      })
    ).json();
  } finally {
    inflight.delete(session.id);
  }
}
