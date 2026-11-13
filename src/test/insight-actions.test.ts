// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { updateActionDraft } from "@/lib/research/actions";
import { reviewFinding } from "@/lib/research/review";
import { highlightRange } from "@/lib/research/evidence";
import { blindPayload } from "@/lib/research/aiReview";
import { clearAll, getSession, saveSession } from "@/lib/research/sessionStorage";
import { makeSession, modelOutput } from "./research-fixtures";
beforeEach(() => clearAll());
describe("researcher next-step drafts", () => {
  it("persists a human-approved draft without changing the model output or issue evidence", async () => {
    let session = makeSession();
    session.runs[0]!.raw_output = modelOutput();
    const original = structuredClone(session.runs);
    const finding = session.findings[0]!;
    session = updateActionDraft(session, finding.id, {
      title: "Clarify loading feedback",
      scope: "Explain the wait on item details and measure repeated taps.",
    });
    session = updateActionDraft(session, finding.id, { status: "approved" });
    await saveSession(session);
    expect((await getSession(session.id))?.findings[0]?.next_step).toMatchObject({
      status: "approved",
      title: "Clarify loading feedback",
    });
    expect(session.runs).toEqual(original);
    expect(session.findings[0]?.description).toBe(finding.description);
    expect(JSON.stringify(blindPayload(session, []))).not.toContain("Clarify loading feedback");
  });
  it("requires accepted evidence and meaningful scope before approval", () => {
    const session = makeSession();
    const id = session.findings[0]!.id;
    expect(() => updateActionDraft(session, id, { status: "approved" })).toThrow(
      "Accept the finding",
    );
    const pending = reviewFinding(
      updateActionDraft(session, id, { title: "Title", scope: "Scope" }),
      id,
      { review_status: "pending" },
    );
    expect(() => updateActionDraft(pending, id, { status: "approved" })).toThrow();
  });
  it("revokes draft approval after edits or reopened/rejected evidence", () => {
    let session = makeSession();
    const id = session.findings[0]!.id;
    session = updateActionDraft(session, id, {
      title: "First scope",
      scope: "Check the waiting state",
    });
    session = updateActionDraft(session, id, { status: "approved" });
    expect(
      updateActionDraft(session, id, { scope: "A different scope" }).findings[0]?.next_step?.status,
    ).toBe("draft");
    expect(
      reviewFinding(session, id, { review_status: "rejected" }).findings[0]?.next_step?.status,
    ).toBe("draft");
    expect(
      reviewFinding(session, id, { review_status: "pending" }).findings[0]?.next_step?.status,
    ).toBe("draft");
  });
});
describe("evidence highlight ranges", () => {
  it("centers a four-second range and clamps short recordings and calibration", () => {
    expect(highlightRange(10000, 20000)).toEqual({ start_ms: 8000, end_ms: 12000 });
    expect(highlightRange(100, 20000)).toEqual({ start_ms: 0, end_ms: 4000 });
    expect(highlightRange(19900, 20000)).toEqual({ start_ms: 16000, end_ms: 20000 });
    expect(highlightRange(1000, 1500)).toEqual({ start_ms: 0, end_ms: 1500 });
    expect(highlightRange(10000, 20000, 500)).toEqual({ start_ms: 8500, end_ms: 12500 });
    expect(highlightRange(19000, 20000, 500, 19500).end_ms).toBe(19500);
    expect(highlightRange(0, 0)).toEqual({ start_ms: 0, end_ms: 0 });
  });
});
