import { describe, expect, it } from "vitest";
import { computeHqStats, usageWindow } from "@/lib/research/hqStats";
import { analysesToday } from "@/lib/research/agentSettings";
import { buildUnifiedInsights } from "@/lib/research/unifiedInsights";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";

const now = new Date("2026-11-15T18:00:00");
const at = (iso: string) => new Date(iso).toISOString();

function session(source: string, tokens: number, started: string, findings = 1) {
  const run = makeRun({
    usage: { total_tokens: tokens },
    started_at: at(started),
    completed_at: at(started),
  });
  return makeSession({
    source_app: source,
    runs: [run],
    findings: Array.from({ length: findings }, () =>
      makeFinding({ analysis_run_id: run.id, review_status: "pending" }),
    ),
  });
}

describe("HQ stats", () => {
  it("counts the same insights the Insights page lists, per product", () => {
    const sessions = [
      session("Uber Eats", 100, "2026-11-15T10:00:00", 2),
      session("Bag checkout app", 200, "2026-11-15T11:00:00", 3),
    ];
    const stats = computeHqStats(sessions, { now, usageSince: null });
    for (const product of stats.products) {
      const items = buildUnifiedInsights(sessions, product.id);
      expect(product.tracker).toBe(
        items.filter((i) => i.kind === "real" && i.source === "tracker").length,
      );
    }
    expect(stats.insights.tracker).toBe(5);
  });

  it("uses one window for analyses and tokens, matching the daily cap", () => {
    const sessions = [
      session("Uber Eats", 100, "2026-11-15T10:00:00"),
      session("Uber Eats", 900, "2026-11-14T10:00:00"),
    ];
    const stats = computeHqStats(sessions, { now, usageSince: null });
    expect(stats.usage.tracker).toEqual({ analyses: 1, tokens: 100 });
    expect(stats.capToday.tracker).toBe(analysesToday(sessions, now, "tracker"));
    expect(stats.usage.tracker.analyses).toBe(stats.capToday.tracker);
    expect(stats.products.reduce((n, p) => n + p.tokens, 0)).toBe(
      stats.usage.tracker.tokens + stats.usage.explorer.tokens,
    );
  });

  it("starts the window at a reset later than midnight", () => {
    const sessions = [
      session("Uber Eats", 100, "2026-11-15T10:00:00"),
      session("Uber Eats", 40, "2026-11-15T17:00:00"),
    ];
    const reset = at("2026-11-15T12:00:00");
    expect(usageWindow(now, reset)).toEqual({ start: reset, fromReset: true });
    const stats = computeHqStats(sessions, { now, usageSince: reset });
    expect(stats.usage.tracker).toEqual({ analyses: 1, tokens: 40 });
    // The cap still counts the whole day, as the Analyze button does.
    expect(stats.capToday.tracker).toBe(2);
    // A reset from an earlier day does not shrink today's window.
    expect(usageWindow(now, at("2026-11-14T12:00:00")).fromReset).toBe(false);
  });
});
