import { z } from "zod";
import { safeMetadata } from "./eventLogger";
import { categories, type Session, type Finding, type AnalysisMode } from "./types";
import type { Frame } from "./frameSampler";

export const proposalSchema = z.object({
  category: z.enum(categories),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(4000),
  timestamp_ms: z.number().finite().nonnegative(),
  end_timestamp_ms: z.number().finite().nonnegative().optional(),
  screen: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1),
  visual_evidence: z.string().max(4000),
  observed_evidence: z.string().min(1).max(4000),
  interpretation: z.string().max(4000),
  event_ids: z.array(z.string()).max(100),
  why_video_matters: z.string().max(4000),
  evidence_sources: z
    .array(z.enum(["video", "events"]))
    .min(1)
    .max(2),
});
export const outputSchema = z.object({ findings: z.array(proposalSchema).max(50) }).strict();
export interface EvidenceContext {
  id: string;
  duration_ms: number;
  events: { id: string }[];
}
export function validateFindings(
  raw: unknown,
  session: EvidenceContext,
  runId: string,
  mode: AnalysisMode = "video_frames_plus_events",
): Finding[] {
  return outputSchema.parse(raw).findings.map((f) => {
    if (
      f.timestamp_ms > session.duration_ms ||
      (f.end_timestamp_ms !== undefined &&
        (f.end_timestamp_ms < f.timestamp_ms || f.end_timestamp_ms > session.duration_ms))
    )
      throw new Error("Model returned a timestamp outside the recording.");
    if (f.event_ids.some((id) => !session.events.some((e) => e.id === id)))
      throw new Error("Model cited an unknown event ID. Analysis was rejected.");
    if (f.evidence_sources.includes("events") && !f.event_ids.length)
      throw new Error("Event evidence must cite an observed event.");
    if (
      mode === "events_only" &&
      (f.evidence_sources.includes("video") || f.visual_evidence || f.why_video_matters)
    )
      throw new Error("Events-only analysis claimed visual evidence.");
    return {
      ...f,
      id: crypto.randomUUID(),
      session_id: session.id,
      analysis_run_id: runId,
      review_status: "pending",
    };
  });
}
// Enumerate every allowed input; never spread a session into a model request.
export function blindPayload(
  session: Session,
  frames: Frame[],
  mode: AnalysisMode = "video_frames_plus_events",
) {
  const events = session.events.map(
    ({ id, t_ms, type, screen, target_id, x, y, operation_id, metadata }) => ({
      id,
      t_ms,
      type,
      screen,
      target_id,
      x,
      y,
      operation_id,
      metadata: safeMetadata(metadata),
    }),
  );
  const common = { duration_ms: session.duration_ms, events, categories: [...categories], mode };
  // The baseline has no images, crop metadata, or visual context keys at all.
  return mode === "events_only" ? common : { ...common, frames };
}
