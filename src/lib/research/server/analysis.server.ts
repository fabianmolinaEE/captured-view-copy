import { youtubeId, validatePublicClip } from "../publicVideo";
import { z } from "zod";
import { agentFocusAreas, suggestedRoutes, type AnalysisRun, type Finding } from "../types";
import { competitorOf } from "../competitors";
import { isProductId, products, type ProductId } from "../products";
import { validateFindings } from "../aiReview";
import { analysisPrompt } from "./analysisPrompt.server";
import { MAX_CLOSE_UPS, type Frame } from "../frameSampler";
import { geminiRequestError } from "./geminiErrors.server";

const eventSchema = z
  .object({
    id: z.string().max(100),
    t_ms: z.number().finite().nonnegative(),
    type: z.string().max(100),
    screen: z.string().max(200),
    target_id: z.string().max(200).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    operation_id: z.string().max(100).optional(),
    metadata: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
  })
  .strict();
export const analysisInput = z
  .object({
    session_id: z.string().uuid(),
    run_id: z.string().uuid(),
    duration_ms: z
      .number()
      .positive()
      .max(60 * 60 * 1000),
    mode: z.enum(["events_only", "video_frames_plus_events", "public_video"]),
    youtube_video: z
      .object({
        url: z
          .string()
          .max(200)
          .refine((url) => !!youtubeId(url), "Use a canonical public YouTube watch URL."),
        start_ms: z.number().finite().nonnegative(),
        end_ms: z.number().finite().positive(),
      })
      .strict()
      .optional(),
    // Accept legacy clients without priming the model with planted bug categories.
    categories: z.array(z.string().max(80)).max(50).optional(),
    // Prompt emphasis only: an allow-listed enum, never free text, never sent as evidence.
    focus_areas: z
      .array(z.enum(agentFocusAreas))
      .max(agentFocusAreas.length)
      .refine((areas) => new Set(areas).size === areas.length, "Focus areas must be unique.")
      .optional(),
    // Explorer: a product id only (never free text); the server maps it to fixed names.
    competitor_of: z
      .string()
      .max(40)
      .refine(
        (id): id is ProductId => isProductId(id) && !!competitorOf(id),
        "Unknown product for competitor analysis.",
      )
      .optional(),
    events: z.array(eventSchema).max(10000),
    frames: z
      .array(
        z
          .object({
            t_ms: z.number().nonnegative(),
            image: z
              .string()
              .max(1000000)
              .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
            width: z.number().int().positive().max(4096).optional(),
            height: z.number().int().positive().max(4096).optional(),
            // A close-up's area as fractions of the app crop; never free text.
            region: z
              .object({
                x: z.number().min(0).max(1),
                y: z.number().min(0).max(1),
                width: z.number().positive().max(1),
                height: z.number().positive().max(1),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      // Up to 40 full frames plus a few bounded close-ups.
      .max(40 + MAX_CLOSE_UPS)
      .refine(
        (frames) => frames.filter((f) => f.region).length <= MAX_CLOSE_UPS,
        "Too many close-up frames.",
      )
      .refine((frames) => frames.filter((f) => !f.region).length <= 40, "Too many sampled frames.")
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.mode === "public_video") {
      if (!data.youtube_video || data.frames !== undefined || data.events.length)
        ctx.addIssue({
          code: "custom",
          message:
            "Public video input requires a video segment and no frames or interaction events.",
        });
      if (data.youtube_video) {
        try {
          validatePublicClip(
            data.duration_ms,
            data.youtube_video.start_ms,
            data.youtube_video.end_ms,
          );
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Invalid public video segment; maximum five minutes.",
          });
        }
      }
    } else if (data.youtube_video !== undefined || data.competitor_of !== undefined)
      ctx.addIssue({
        code: "custom",
        message: "YouTube and competitor input are only allowed in public-video mode.",
      });
    if (data.mode === "events_only" && data.frames !== undefined)
      ctx.addIssue({ code: "custom", message: "The events-only baseline must exclude frames." });
    if (data.mode === "video_frames_plus_events" && !data.frames?.length)
      ctx.addIssue({ code: "custom", message: "Multimodal analysis requires frames." });
    if (
      data.events.some((e) => e.t_ms > data.duration_ms) ||
      data.frames?.some((f) => f.t_ms > data.duration_ms)
    )
      ctx.addIssue({ code: "custom", message: "Evidence timestamp exceeds session duration." });
    if (new Set(data.events.map((e) => e.id)).size !== data.events.length)
      ctx.addIssue({ code: "custom", message: "Event IDs must be unique." });
  });
export type AnalysisInput = z.infer<typeof analysisInput>;
export const responseJsonSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      // Gemini 3.5 Flash-Lite rejected this schema with maxItems: 50 (HTTP 400).
      // Keep the provider grammar simple; outputSchema still enforces 50 server-side.
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          recommendation: { type: "string" },
          expected_benefit: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          timestamp_ms: { type: "number" },
          end_timestamp_ms: { type: "number" },
          screen: { type: "string" },
          confidence: { type: "number" },
          visual_evidence: { type: "string" },
          observed_evidence: { type: "string" },
          interpretation: { type: "string" },
          event_ids: { type: "array", items: { type: "string" } },
          why_video_matters: { type: "string" },
          evidence_sources: { type: "array", items: { type: "string", enum: ["video", "events"] } },
          // Optional: the model adds it whenever it proposes a concrete change.
          suggested_test: {
            type: "object",
            properties: {
              hypothesis: { type: "string" },
              change: { type: "string" },
              primary_metric: { type: "string" },
              guardrail_metric: { type: "string" },
              target_screen: { type: "string" },
            },
            required: ["hypothesis", "change", "primary_metric"],
          },
          suggested_route: { type: "string", enum: [...suggestedRoutes] },
        },
        required: [
          "category",
          "recommendation",
          "expected_benefit",
          "title",
          "description",
          "timestamp_ms",
          "confidence",
          "visual_evidence",
          "observed_evidence",
          "interpretation",
          "event_ids",
          "why_video_matters",
          "evidence_sources",
        ],
      },
    },
  },
  required: ["findings"],
};
const fraction = (value: number) => Number(value.toFixed(3));
/** Fixed label built only from numeric frame metadata. */
export function frameLabel(frame: Frame) {
  const size = frame.width && frame.height ? `${frame.width}×${frame.height} px` : "size unknown";
  if (!frame.region) return `Video frame at ${frame.t_ms} ms (full app crop, ${size})`;
  const r = frame.region;
  return `Close-up at ${frame.t_ms} ms (${size}) of the same frame, enlarged from the app-crop area x ${fraction(r.x)}–${fraction(r.x + r.width)}, y ${fraction(r.y)}–${fraction(r.y + r.height)} (fractions of the app crop width and height)`;
}
/** Gemini agentic video processing for public videos ("STATIC" restores fixed-rate sampling). */
export const PUBLIC_VIDEO_PROCESSING = "AGENTIC" as const;
const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
/** Fixed text built only from numeric clip bounds. */
export function publicWindowInstruction(clip: { start_ms: number; end_ms: number }) {
  return `Analyze only the segment from ${mmss(clip.start_ms)} to ${mmss(clip.end_ms)} of this video (start_ms ${clip.start_ms}, end_ms ${clip.end_ms}). Ignore everything outside it. Every finding's timestamp_ms and end_timestamp_ms must be inside this segment, in milliseconds on the full video's timeline.`;
}
export function geminiBody(input: AnalysisInput) {
  const {
    frames,
    categories: _categories,
    focus_areas: focus,
    competitor_of: competitorFor,
    session_id: _session,
    run_id: _run,
    ...evidence
  } = input;
  const ours = products.find((product) => product.id === competitorFor);
  const theirs = competitorFor ? competitorOf(competitorFor as ProductId) : null;
  return {
    systemInstruction: {
      parts: [
        {
          text: analysisPrompt(
            input.mode,
            focus ?? [],
            ours && theirs ? { product: ours.name, competitor: theirs.name } : undefined,
          ),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: JSON.stringify(evidence) },
          ...(input.mode === "public_video" && input.youtube_video
            ? [
                // Agentic video understanding: the model navigates the timeline itself and picks
                // segments, frame rates and modalities. videoMetadata clipping/fps is static-only
                // per the Gemini docs, so the window goes in a fixed numeric instruction instead
                // and is still enforced on every returned finding below.
                {
                  fileData: { fileUri: input.youtube_video.url, mimeType: "video/mp4" },
                  media_processing: PUBLIC_VIDEO_PROCESSING,
                },
                { text: publicWindowInstruction(input.youtube_video) },
              ]
            : []),
          ...(input.mode === "events_only"
            ? []
            : (frames ?? []).flatMap((f) => [
                { text: frameLabel(f) },
                { inlineData: { mimeType: "image/jpeg", data: f.image.split(",")[1] } },
              ])),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema,
      maxOutputTokens: 12000,
      // Small controls and fine labels need full image detail. Documented GenerationConfig enum;
      // public video keeps the provider default so its per-frame video cost is unchanged.
      ...(input.mode === "video_frames_plus_events"
        ? { mediaResolution: "MEDIA_RESOLUTION_HIGH" }
        : {}),
    },
  };
}
const providerSchema = z.object({
  modelVersion: z.string().optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z.array(
              z.object({ text: z.string().optional(), thought: z.boolean().optional() }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      totalTokenCount: z.number().optional(),
    })
    .optional(),
});
export async function analyze(
  input: AnalysisInput,
  key: string,
  model: string,
  fetcher: typeof fetch = fetch,
): Promise<{ findings: Finding[]; run: AnalysisRun }> {
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    throw new Error("GEMINI_MODEL must be a model identifier, without a URL or models/ prefix.");
  const started = Date.now();
  const started_at = new Date(started).toISOString();
  const body = geminiBody(input);
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body))),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const response = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!response.ok) {
    // Provider messages can echo request data. Only return a fixed, classified hint.
    const detail: unknown = await response.json().catch(() => undefined);
    throw geminiRequestError(response.status, detail);
  }
  const data = providerSchema.parse(await response.json());
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason !== "STOP")
    throw new Error(
      "Gemini did not finish a valid response. It may have been blocked or reached its output limit.",
    );
  // Agentic video responses also carry tool_call/tool_response parts (no text); skip them.
  const texts = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string" && p.text.trim())
    .map((p) => p.text!);
  if (!texts.length) throw new Error("Gemini returned no structured findings.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(texts.join(""));
  } catch {
    try {
      // Fall back to the final text part, which holds the structured answer.
      parsed = JSON.parse(texts[texts.length - 1]!);
    } catch {
      throw new Error("Gemini returned malformed JSON. No proposals were saved.");
    }
  }
  const findings = validateFindings(
    parsed,
    { id: input.session_id, duration_ms: input.duration_ms, events: input.events },
    input.run_id,
    input.mode,
  );
  for (const finding of findings) {
    if (input.mode === "public_video" && input.youtube_video) {
      if (
        finding.timestamp_ms < input.youtube_video.start_ms ||
        (finding.end_timestamp_ms ?? finding.timestamp_ms) > input.youtube_video.end_ms ||
        !finding.visual_evidence.trim() ||
        finding.event_ids.length ||
        finding.evidence_sources.length !== 1 ||
        finding.evidence_sources[0] !== "video"
      )
        throw new Error(
          "Public-video findings must cite visible evidence within the requested segment, without internal event claims.",
        );
      continue;
    }
    if (
      finding.evidence_sources.includes("video") &&
      (!finding.visual_evidence.trim() ||
        !input.frames?.some(
          (frame) =>
            frame.t_ms >= finding.timestamp_ms - 2000 &&
            frame.t_ms <= (finding.end_timestamp_ms ?? finding.timestamp_ms) + 2000,
        ))
    )
      throw new Error("Model claimed visual evidence without a nearby sampled frame.");
  }
  const usage = data.usageMetadata;
  return {
    findings,
    run: {
      id: input.run_id,
      mode: input.mode,
      model_name: data.modelVersion ?? model,
      status: "completed" as const,
      ...(input.mode === "public_video"
        ? { source_clip: input.youtube_video! }
        : { frame_count: input.frames?.filter((f) => !f.region).length ?? 0 }),
      started_at,
      completed_at: new Date().toISOString(),
      latency_ms: Date.now() - started,
      raw_output: parsed,
      input_fingerprint: fingerprint,
      ...(input.focus_areas?.length ? { focus_areas: [...input.focus_areas] } : {}),
      ...(input.competitor_of ? { competitor_of: input.competitor_of as ProductId } : {}),
      // Full sampled frames only; close-ups repeat one of these timestamps.
      frame_timestamps_ms: input.frames?.filter((f) => !f.region).map((f) => f.t_ms) ?? [],
      ...(usage
        ? {
            usage: {
              ...(usage.promptTokenCount !== undefined
                ? { input_tokens: usage.promptTokenCount }
                : {}),
              ...(usage.candidatesTokenCount !== undefined
                ? { output_tokens: usage.candidatesTokenCount }
                : {}),
              ...(usage.totalTokenCount !== undefined
                ? { total_tokens: usage.totalTokenCount }
                : {}),
            },
          }
        : {}),
    },
  };
}
