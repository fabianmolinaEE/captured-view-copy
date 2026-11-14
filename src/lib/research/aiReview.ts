import { z } from "zod";
import { safeMetadata } from "./eventLogger";
import {
  agentFocusAreas,
  suggestedRoutes,
  type AgentFocus,
  type AnalysisMode,
  type Finding,
  type Session,
} from "./types";
import type { Frame } from "./frameSampler";

const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0, "Must not be blank.");
/** Predicted effect sizes, uplift estimates and sample sizes are not allowed in a suggested test. */
const effectSize =
  /\d\s*%|(^|[\s(])[+\u2212]\s?\d|\b\d+(\.\d+)?\s*x\s+(more|fewer|less|faster|higher|lower)\b|\bn\s*=\s*\d|\bp\s*[<=]\s*0?\.\d|\bsample size of\s*\d|\bstatistical(ly)? significan/i;
const noEffectSize = (value: string) => !effectSize.test(value);
/**
 * Metric names may mention ordinal labels ("step 2", "top 3 dishes"), but never a target, threshold,
 * rate denominator, effect size or sample size.
 */
const metricNumber =
  /\d[\d,.]*\s*(%|percent\b|per\b|sessions?\b|users?\b|participants?\b|visitors?\b|customers?\b|orders?\b|ms\b|s\b|secs?\b|seconds?\b|mins?\b|minutes?\b|x\b)|[<>\u2264\u2265]\s*\d|\b(under|below|above|over|at least|at most|less than|more than|fewer than|within|by)\s+\d/i;
const noDigits = [
  (value: string) => !effectSize.test(value) && !metricNumber.test(value),
  "Metrics are free-text names without targets, thresholds, sample sizes or predicted effects.",
] as const;
const metric = (max: number) => nonBlank(max).refine(...noDigits);
/** Model-proposed test: strict keys and bounds. Any failure fails the whole run. */
export const suggestedTestSchema = z
  .object({
    hypothesis: nonBlank(600).refine(noEffectSize, "Hypotheses must not predict an effect size."),
    change: nonBlank(600).refine(noEffectSize, "Changes must not predict an effect size."),
    primary_metric: metric(120),
    // Optional fields may be omitted or empty (= no value); they are stored verbatim either way.
    guardrail_metric: z
      .string()
      .max(120)
      .refine(...noDigits)
      .optional(),
    target_screen: z.string().max(200).optional(),
  })
  .strict();
export const proposalSchema = z.object({
  category: z.string().trim().min(1).max(80),
  recommendation: z.string().max(4000).optional(),
  expected_benefit: z.string().max(2000).optional(),
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
  suggested_test: suggestedTestSchema.optional(),
  /** fix = clear problem and remedy (Fixer); experiment = open question (Experimenter). */
  suggested_route: z.enum(suggestedRoutes).optional(),
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
export interface PayloadOptions {
  /** Allow-listed emphasis lenses; unknown or duplicate values are dropped client-side. */
  focus_areas?: readonly AgentFocus[] | undefined;
}
export function blindPayload(
  session: Session,
  frames: Frame[],
  mode: AnalysisMode = "video_frames_plus_events",
  options: PayloadOptions = {},
) {
  const events = (mode === "public_video" ? [] : session.events).map(
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
  // Emphasis only: a fixed enum in canonical order, never free text and never evidence.
  const focus = agentFocusAreas.filter((area) => options.focus_areas?.includes(area));
  const common = {
    duration_ms: session.duration_ms,
    events,
    mode,
    ...(focus.length ? { focus_areas: focus } : {}),
  };
  if (mode === "public_video") {
    if (!session.public_video) throw new Error("Public video provenance is missing.");
    const competitor = session.public_video.competitor_of;
    return {
      ...common,
      youtube_video: {
        url: session.public_video.url,
        start_ms: session.public_video.start_ms,
        end_ms: session.public_video.end_ms,
      },
      // A product id only: the server maps it to fixed product/competitor names.
      ...(competitor ? { competitor_of: competitor } : {}),
    };
  }
  // The baseline has no images, crop metadata, or visual context keys at all.
  return mode === "events_only" ? common : { ...common, frames };
}
