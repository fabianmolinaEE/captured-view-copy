import { blindPayload } from "./aiReview";
import { extractFrames } from "./frameSampler";
import { getSampling } from "./sessionStorage";
import type { Session, AnalysisMode, AnalysisRun, Finding } from "./types";
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
export async function analyzeSession(
  session: Session,
  mode: AnalysisMode,
  progress: (message: string) => void,
): Promise<{ run: AnalysisRun; findings: Finding[] }> {
  if (inflight.has(session.id)) throw new Error("Analysis is already running for this session.");
  if (!session.consent_confirmed) throw new Error("A consented test session is required.");
  if (mode === "video_frames_plus_events" && !session.capture_region)
    throw new Error(
      "Record a new session with a checkout crop before multimodal analysis. This older recording may show researcher answers outside the checkout.",
    );
  inflight.add(session.id);
  try {
    progress(
      mode === "events_only" ? "Preparing events-only input…" : "Extracting checkout video frames…",
    );
    const frames =
      mode === "events_only"
        ? []
        : await extractFrames(
            session.video_blob,
            session.duration_ms,
            session.events,
            await getSampling(),
            session.video_start_offset_ms,
            session.capture_region,
            session.capture_region_valid_from_ms ?? 0,
          );
    progress(`Waiting for Gemini · ${frames.length} frames · ${session.events.length} events…`);
    return await (
      await researchFetch("analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          run_id: crypto.randomUUID(),
          ...blindPayload(session, frames, mode),
        }),
      })
    ).json();
  } finally {
    inflight.delete(session.id);
  }
}
