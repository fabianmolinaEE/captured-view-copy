// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { geminiRequestError } from "@/lib/research/server/geminiErrors.server";
import { analyze, analysisInput, geminiBody } from "@/lib/research/server/analysis.server";
import { outputSchema } from "@/lib/research/aiReview";
import { categories } from "@/lib/research/types";
import { modelOutput } from "./research-fixtures";

const input = () =>
  analysisInput.parse({
    session_id: crypto.randomUUID(),
    run_id: crypto.randomUUID(),
    mode: "events_only",
    duration_ms: 1000,
    categories: [...categories],
    events: [],
  });
describe("Gemini request compatibility", () => {
  it("omits the provider maxItems constraint while retaining the strict local finding limit", () => {
    const body = geminiBody(input());
    expect(body.generationConfig.responseJsonSchema.properties.findings).not.toHaveProperty(
      "maxItems",
    );
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    const proposal = modelOutput().findings[0];
    const overLimit = outputSchema.safeParse({
      findings: Array.from({ length: 51 }, () => proposal),
    });
    expect(overLimit.success).toBe(false);
    if (!overLimit.success)
      expect(overLimit.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "too_big", path: ["findings"] })]),
      );
    expect(body.generationConfig.responseJsonSchema.properties.findings.items.required).toContain(
      "observed_evidence",
    );
  });
  it("does not retry rejected requests or relay the provider error body", async () => {
    const secret = "test-secret-api-key";
    const raw = {
      error: {
        status: "INVALID_ARGUMENT",
        message: `Echoed ${secret} and private-session-input`,
        details: [{ reason: "UNKNOWN_REASON", metadata: { project: "private-project" } }],
      },
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json(raw, { status: 400 }));
    const failure = await analyze(input(), secret, "test-model", fetcher).catch((e) => e as Error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("request format or input");
    for (const sensitive of [secret, "private-session-input", "private-project", "UNKNOWN_REASON"])
      expect((failure as Error).message).not.toContain(sensitive);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
describe("safe Gemini error hints", () => {
  it.each([
    [400, { status: "INVALID_ARGUMENT" }, "request format or input"],
    [
      400,
      { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] },
      "API key is invalid",
    ],
    [400, { status: "FAILED_PRECONDITION", message: "Billing must be enabled" }, "billing plan"],
    [401, { status: "UNAUTHENTICATED" }, "authenticate"],
    [
      403,
      { status: "PERMISSION_DENIED", details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }] },
      "restrictions block",
    ],
    [
      403,
      { status: "PERMISSION_DENIED", details: [{ reason: "SERVICE_DISABLED" }] },
      "Enable the Generative Language API",
    ],
    [403, { status: "PERMISSION_DENIED" }, "lacks permission"],
    [404, { status: "NOT_FOUND" }, "selected model is unavailable"],
    [413, {}, "input is too large"],
    [429, { status: "RESOURCE_EXHAUSTED" }, "quota or rate limits"],
    [503, { status: "UNAVAILABLE" }, "temporarily unavailable"],
  ])("classifies HTTP %s without returning raw provider text", (status, detail, hint) => {
    const message = geminiRequestError(status, { error: detail }).message;
    expect(message).toContain(hint);
    expect(message).toContain(`HTTP ${status}`);
  });
  it("handles non-JSON and malicious diagnostic metadata safely", () => {
    expect(geminiRequestError(400, undefined).message).toContain("request format or input");
    const message = geminiRequestError(400, {
      error: {
        status: "PRIVATE_SECRET",
        message: "schema complexity PRIVATE_MESSAGE",
        details: [{ reason: "PRIVATE_REASON" }],
      },
    }).message;
    expect(message).toContain("structured-output schema");
    expect(message).not.toContain("PRIVATE_");
  });
});
