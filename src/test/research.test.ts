// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { EventLogger } from "@/lib/research/eventLogger";
import { sampleTimes } from "@/lib/research/frameSampler";
import { blindPayload, validateFindings } from "@/lib/research/aiReview";
import { analysisInput, geminiBody, analyze } from "@/lib/research/server/analysis.server";
import { handleResearchRequest } from "@/lib/research/server/api.server";
import { aggregateInsights } from "@/lib/research/insights";
import { score, pairedScores } from "@/lib/research/evaluation";
import { reviewFinding } from "@/lib/research/review";
import { defaultSampling } from "@/lib/research/types";
import { makeSession, makeRun, makeFinding, modelOutput } from "./research-fixtures";
afterEach(() => vi.restoreAllMocks());
describe("recording-relative evidence", () => {
  it("anchors events once, stops logging, and excludes form secrets", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1250);
    const logger = new EventLogger();
    logger.start("a", 1000);
    logger.log("input_change", "form", {
      metadata: { changed: true, password: "secret", card_number: "1234", token: "secret" },
    });
    expect(logger.stop()[0]).toMatchObject({ t_ms: 250, metadata: { changed: true } });
    now.mockReturnValue(3000);
    logger.log("late", "form");
    expect(logger.events).toHaveLength(1);
  });
  it("caps, sorts, deduplicates and bounds sampled timestamps", () => {
    for (const ms of [0, 1, 50, 2000, 5000, 300000]) {
      const times = sampleTimes(ms, makeSession().events, defaultSampling);
      expect(times.length).toBeLessThanOrEqual(24);
      expect(times).toEqual([...new Set(times)].sort((a, b) => a - b));
      expect(times.every((t) => t >= 0 && t < ms)).toBe(true);
    }
  });
  it("covers the end and samples around a brief failure", () => {
    const times = sampleTimes(
      60000,
      [{ ...makeSession().events[0]!, type: "application_timeout", t_ms: 12100 }],
      defaultSampling,
    );
    expect(times).toContain(59900);
    expect(times).toContain(12300);
  });
});
describe("blind model boundary", () => {
  it("excludes configuration, labels, human notes and prior model results", () => {
    const session = makeSession();
    session.title = "SECRET_TITLE";
    session.issues[0]!.notes = "SECRET_LABEL";
    session.findings[0]!.reviewer_note = "SECRET_REVIEW";
    session.events[0]!.metadata = { password: "SECRET_PASSWORD" };
    const payload = JSON.stringify(blindPayload(session, []));
    for (const key of [
      "SECRET_",
      "scenario_config",
      "loading_delay_ms",
      "review_status",
      "issues",
      "findings",
    ])
      expect(payload).not.toContain(key);
  });
  it("baseline excludes every frame and all visual context keys", () => {
    const s = makeSession();
    const payload = blindPayload(s, [{ t_ms: 1000, image: "SECRET_IMAGE" }], "events_only");
    expect(payload).not.toHaveProperty("frames");
    expect(JSON.stringify(payload)).not.toContain("SECRET_IMAGE");
    const input = analysisInput.parse({
      ...payload,
      session_id: s.id,
      run_id: crypto.randomUUID(),
    });
    const body = JSON.stringify(geminiBody(input));
    expect(body).not.toContain("inlineData");
    expect(body).not.toContain("Video frame at");
    expect(() => analysisInput.parse({ ...input, frames: [] })).toThrow();
    expect(() => analysisInput.parse({ ...input, issues: [] })).toThrow();
  });
  it("validates structured findings and rejects fabricated event IDs or timestamps", () => {
    const s = makeSession();
    expect(validateFindings(modelOutput(), s, "run")[0]?.review_status).toBe("pending");
    for (const patch of [
      { event_ids: ["invented"] },
      { timestamp_ms: 99999 },
      { timestamp_ms: -1 },
      { confidence: 2 },
      { end_timestamp_ms: 10 },
    ])
      expect(() => validateFindings(modelOutput(patch), s, "run")).toThrow();
    expect(() => validateFindings(modelOutput(), s, "run", "events_only")).toThrow();
  });
  it("calls the actual provider protocol, preserves output, and records only reported usage", async () => {
    const s = makeSession();
    const input = analysisInput.parse({
      ...blindPayload(s, [], "events_only"),
      session_id: s.id,
      run_id: crypto.randomUUID(),
    });
    const raw = modelOutput({
      visual_evidence: "",
      why_video_matters: "",
      evidence_sources: ["events"],
    });
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        modelVersion: "test-returned-version",
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }],
        usageMetadata: { totalTokenCount: 123 },
      }),
    );
    const result = await analyze(input, "test-secret", "test-model", fetcher);
    expect(fetcher.mock.calls[0]?.[0]).toContain("test-model:generateContent");
    expect(result.run.raw_output).toEqual(raw);
    expect(result.run.model_name).toBe("test-returned-version");
    expect(result.run.usage).toEqual({ total_tokens: 123 });
    expect(result.run.frame_count).toBe(0);
    expect(result.run.input_fingerprint).toHaveLength(64);
  });
  it("rejects malformed, truncated, blocked and failed provider responses", async () => {
    const s = makeSession();
    const input = analysisInput.parse({
      ...blindPayload(s, [], "events_only"),
      session_id: s.id,
      run_id: crypto.randomUUID(),
    });
    for (const response of [
      new Response("secret", { status: 429 }),
      Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
      Response.json({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: "bad json" }] } }],
      }),
    ])
      await expect(
        analyze(input, "key", "model", vi.fn().mockResolvedValue(response)),
      ).rejects.toThrow();
  });
  it("protects remote APIs and does not expose server secrets in status", async () => {
    const env = { GEMINI_API_KEY: "secret-key", RESEARCH_ACCESS_TOKEN: "workspace-secret" };
    const response = await handleResearchRequest(
      new Request("https://research.example/api/research/status"),
      env,
    );
    const text = await response.text();
    expect(text).not.toContain("secret-key");
    expect(text).not.toContain("workspace-secret");
    expect(
      (
        await handleResearchRequest(
          new Request("https://research.example/api/research/analyze", { method: "POST" }),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleResearchRequest(
          new Request("https://research.example/api/research/analyze", {
            method: "POST",
            headers: { Origin: "https://evil.example" },
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleResearchRequest(
          new Request("https://research.example/api/research/analyze", { method: "POST" }),
          {},
        )
      ).status,
    ).toBe(503);
  });
});
describe("human review and prioritization", () => {
  it("preserves original model output while changing researcher decisions", () => {
    const s = makeSession();
    s.runs[0]!.raw_output = modelOutput();
    const before = structuredClone(s.runs);
    const updated = reviewFinding(s, s.findings[0]!.id, {
      review_status: "rejected",
      reviewer_note: "Researcher explanation",
    });
    expect(updated.findings[0]).toMatchObject({
      review_status: "rejected",
      reviewer_note: "Researcher explanation",
    });
    expect(updated.runs).toEqual(before);
  });
  it("groups three equivalent sessions without double-counting proposals or old runs", () => {
    const sessions = [makeSession(), makeSession(), makeSession()];
    sessions[0]!.findings.push({ ...sessions[0]!.findings[0]!, id: "duplicate" });
    const result = aggregateInsights(sessions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ affected: 3, eligible: 3, percentage: 100 });
    const single = aggregateInsights([sessions[0]!]);
    expect(single[0]?.priority).toBe(aggregateInsights([makeSession()])[0]?.priority);
  });
  it("excludes pending and rejected proposals and preserves rare blockers", () => {
    const rare = makeSession();
    rare.findings[0]!.severity = "blocker";
    const clean = Array.from({ length: 10 }, () => makeSession({ findings: [] }));
    expect(aggregateInsights([rare, ...clean])[0]?.priority).toBeGreaterThanOrEqual(85);
    rare.findings[0]!.review_status = "pending";
    expect(aggregateInsights([rare])).toEqual([]);
    rare.findings[0]!.review_status = "rejected";
    expect(aggregateInsights([rare])).toEqual([]);
  });
});
describe("honest evaluation", () => {
  it("deduplicates recall, excludes unknown truth from false positives and unknown video judgments", () => {
    const s = makeSession();
    const first = s.findings[0]!;
    s.issues.push({
      id: "unknown",
      category: "silent_failure",
      screen: "order",
      actually_observed: "unknown",
    });
    s.findings.push(
      { ...first, id: "duplicate" },
      { ...first, id: "unknown-match" },
      { ...first, id: "verified-wrong" },
    );
    s.matches = [
      {
        finding_id: first.id,
        ground_truth_issue_id: "issue",
        reviewer_verified: true,
        video_necessary: "yes",
        evidence_verified: true,
      },
      {
        finding_id: "duplicate",
        ground_truth_issue_id: "issue",
        reviewer_verified: true,
        video_necessary: "unknown",
        evidence_verified: false,
      },
      {
        finding_id: "unknown-match",
        ground_truth_issue_id: "unknown",
        reviewer_verified: true,
        video_necessary: "unknown",
        evidence_verified: false,
      },
      {
        finding_id: "verified-wrong",
        ground_truth_issue_id: null,
        reviewer_verified: true,
        video_necessary: "unknown",
        evidence_verified: false,
        evidence_judged: true,
      },
    ];
    expect(score([s])).toMatchObject({
      observed: 1,
      detected: 1,
      correct: 2,
      reviewed: 3,
      unmatched: 1,
      unresolved: 1,
      videoNeeded: 1,
      videoEvaluated: 1,
      evidence: 1,
      evidenceJudged: 2,
    });
  });
  it("uses identical sessions for paired modes and excludes unanalysed recordings", () => {
    const s = makeSession();
    const baseline = makeRun({ mode: "events_only" });
    s.runs.push(baseline);
    s.findings.push(makeFinding({ analysis_run_id: baseline.id, evidence_sources: ["events"] }));
    const extra = makeSession();
    const pair = pairedScores([s, extra]);
    expect(pair.sessions).toBe(1);
    expect(pair.video.observed).toBe(1);
    expect(pair.events.observed).toBe(1);
    expect(score([makeSession({ runs: [] })]).observed).toBe(0);
  });
});
