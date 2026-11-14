// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { blindPayload } from "@/lib/research/aiReview";
import { analysisInput, analyze, geminiBody } from "@/lib/research/server/analysis.server";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import type { AnalysisMode } from "@/lib/research/types";
import { makeSession, modelOutput } from "./research-fixtures";

describe("general product improvement analysis", () => {
  it.each<AnalysisMode>(["events_only", "video_frames_plus_events", "public_video"])(
    "accepts design opportunities beyond configured bugs in %s while preserving evidence",
    async (mode) => {
      const session =
        mode === "public_video"
          ? createPublicSession(uberEatsCandidates[0], 120000, 0, 60000)
          : makeSession();
      const payload = blindPayload(
        session,
        [{ t_ms: 1000, image: "data:image/jpeg;base64,YQ==" }],
        mode,
      );
      expect(payload).not.toHaveProperty("categories");
      const input = analysisInput.parse({
        ...payload,
        session_id: session.id,
        run_id: crypto.randomUUID(),
        categories: ["SECRET_LEGACY_SCENARIO"],
      });
      const body = geminiBody(input);
      expect(JSON.stringify(body)).not.toContain("SECRET_LEGACY_SCENARIO");
      expect(body.systemInstruction.parts[0]!.text).toContain("engagement or value communication");
      expect(
        body.generationConfig.responseJsonSchema.properties.findings.items.properties.category,
      ).not.toHaveProperty("enum");
      const raw = modelOutput({
        category: "decision_support",
        title: "Make options easier to compare",
        recommendation: "Show size and price together before adding an item.",
        expected_benefit: "Could reduce comparison effort.",
        ...(mode === "public_video" ? { event_ids: [], evidence_sources: ["video"] } : {}),
        ...(mode === "events_only"
          ? { visual_evidence: "", why_video_matters: "", evidence_sources: ["events"] }
          : {}),
      });
      const fetcher = vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } },
          ],
        }),
      );
      const result = await analyze(input, "test-key", "test-model", fetcher);
      expect(result.findings[0]).toMatchObject({
        category: "decision_support",
        recommendation: "Show size and price together before adding an item.",
        review_status: "pending",
        timestamp_ms: 1000,
      });
      expect(result.run.raw_output).toEqual(raw);
      expect(result.findings[0]?.event_ids).toEqual(mode === "public_video" ? [] : ["event"]);
    },
  );
});
