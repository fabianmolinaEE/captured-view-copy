import { beforeEach, describe, expect, it } from "vitest";
import {
  clearUsageCounter,
  loadUsageSince,
  resetUsageCounter,
  tokensSince,
} from "@/lib/research/agentSettings";
import { makeRun, makeSession } from "./research-fixtures";

describe("usage counter", () => {
  beforeEach(() => localStorage.clear());

  it("counts only real usage on runs completed after the reset, without editing runs", () => {
    const old = makeRun({
      completed_at: "2026-11-13T10:00:00.000Z",
      usage: { total_tokens: 9000 },
    });
    const recent = makeRun({
      completed_at: "2026-11-15T12:00:00.000Z",
      usage: { total_tokens: 1200 },
    });
    const session = makeSession({ runs: [old, recent] });
    expect(tokensSince([session], null)).toBe(10200);
    const since = resetUsageCounter(new Date("2026-11-15T09:00:00.000Z"));
    expect(loadUsageSince()).toBe(since);
    expect(tokensSince([session], loadUsageSince())).toBe(1200);
    expect(old.usage?.total_tokens).toBe(9000);
    clearUsageCounter();
    expect(loadUsageSince()).toBeNull();
  });

  it("starts at zero right after a reset", () => {
    const session = makeSession({
      runs: [makeRun({ completed_at: "2026-11-13T10:00:00.000Z", usage: { total_tokens: 500 } })],
    });
    resetUsageCounter(new Date("2026-11-15T09:00:00.000Z"));
    expect(tokensSince([session], loadUsageSince())).toBe(0);
  });
});
