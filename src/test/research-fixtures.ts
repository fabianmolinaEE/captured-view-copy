import type { Session, Finding, AnalysisRun } from "@/lib/research/types";
export function makeRun(patch: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    id: crypto.randomUUID(),
    mode: "video_frames_plus_events",
    model_name: "test-only-model",
    status: "completed",
    frame_count: 2,
    started_at: "2026-11-11T00:00:00.000Z",
    completed_at: "2026-11-11T00:00:01.000Z",
    ...patch,
  };
}
export function makeFinding(patch: Partial<Finding> = {}): Finding {
  return {
    id: crypto.randomUUID(),
    session_id: "session",
    analysis_run_id: "run",
    category: "long_loading",
    title: "Observed spinner",
    description: "A spinner was present.",
    timestamp_ms: 1000,
    screen: "item_details",
    confidence: 0.8,
    visual_evidence: "Spinner at 1000 ms",
    observed_evidence: "A visible spinner",
    interpretation: "May delay checkout",
    event_ids: ["event"],
    why_video_matters: "Visible feedback",
    evidence_sources: ["video", "events"],
    review_status: "accepted",
    ...patch,
  };
}
export function makeSession(patch: Partial<Session> = {}): Session {
  const run = makeRun();
  const finding = makeFinding({ analysis_run_id: run.id });
  return {
    id: crypto.randomUUID(),
    title: "Test recording",
    created_at: "2026-11-11T00:00:00.000Z",
    captured_at: "2026-11-11T00:00:00.000Z",
    duration_ms: 5000,
    video_blob: new Blob(["actual test bytes"], { type: "video/webm" }),
    mime_type: "video/webm",
    extension: "webm",
    capture_mode: "browser_tab",
    source_app: "Carry checkout",
    scenario_config: ["long_loading"],
    loading_delay_ms: 6000,
    status: "reviewed",
    consent_confirmed: true,
    event_count: 1,
    events: [
      {
        id: "event",
        session_id: "session",
        t_ms: 1000,
        type: "spinner_shown",
        screen: "item_details",
      },
    ],
    findings: [finding],
    issues: [
      { id: "issue", category: "long_loading", screen: "item_details", actually_observed: "yes" },
    ],
    matches: [],
    runs: [run],
    video_start_offset_ms: 0,
    capture_region: { x: 0.4, y: 0.1, width: 0.3, height: 0.8 },
    ...patch,
  };
}
export function modelOutput(patch: Record<string, unknown> = {}) {
  const {
    id: _id,
    session_id: _session,
    analysis_run_id: _run,
    review_status: _status,
    ...proposal
  } = makeFinding();
  return { findings: [{ ...proposal, ...patch }] };
}
