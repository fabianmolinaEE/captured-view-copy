import { analysesToday, scoutForSession, type FindingScout } from "./agentSettings";
import { competitorSessionsFor, isCompetitorSession } from "./competitors";
import { isArchivedSession, products, sessionsForProduct, type ProductId } from "./products";
import type { AnalysisRun, Session } from "./types";
import {
  buildUnifiedInsights,
  isRetiredDemoSession,
  type SampleDecisionInput,
  type UnifiedInsight,
} from "./unifiedInsights";

/**
 * One source of truth for HQ numbers. Insight counts come from the same unified list the Insights
 * page renders; analysis counts use the same rule as the Analyze daily cap; tokens are summed over
 * exactly the analyses counted in the same window. Nothing here is estimated or simulated.
 */
export interface UsageWindow {
  /** ISO start: local midnight today, or the usage-counter reset if that is later. */
  start: string;
  /** True when a reset later than midnight starts the window. */
  fromReset: boolean;
}
export function usageWindow(now: Date, usageSince: string | null): UsageWindow {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const reset = usageSince ? Date.parse(usageSince) : NaN;
  const fromReset = Number.isFinite(reset) && reset > midnight;
  return { start: new Date(fromReset ? reset : midnight).toISOString(), fromReset };
}

/** A real analysis an agent ran: reached the provider and is not a bundled pre-generated run. */
export function isAgentAnalysis(session: Session, run: AnalysisRun) {
  return run.reached_provider !== false && !session.pregenerated?.run_ids.includes(run.id);
}

export interface ScoutUsage {
  analyses: number;
  tokens: number;
}
export interface ProductStats {
  id: ProductId;
  name: string;
  /** Real Tracker items on that product's Insights page. */
  tracker: number;
  /** Real Explorer items on that product's Insights page. */
  explorer: number;
  /** Labeled fictional sample items on that product's Insights page. */
  sample: number;
  /** Tokens of agent analyses in the window for that product (own + competitor footage). */
  tokens: number;
}
export interface HqStats {
  window: UsageWindow;
  /** Per-product insight lists, identical to what Insights renders for each product. */
  insightsByProduct: Record<ProductId, UnifiedInsight[]>;
  products: ProductStats[];
  insights: { tracker: number; explorer: number; sample: number };
  /** Analyses and tokens in the window, per scout. */
  usage: Record<FindingScout, ScoutUsage>;
  /** Analyses today per scout, exactly as the Analyze daily cap counts them. */
  capToday: Record<FindingScout, number>;
}

export function computeHqStats(
  stored: Session[],
  options: { now: Date; usageSince: string | null; sampleDecision?: SampleDecisionInput },
): HqStats {
  const sessions = stored.filter((s) => !isRetiredDemoSession(s));
  const window = usageWindow(options.now, options.usageSince);
  const from = Date.parse(window.start);
  const inWindow = (session: Session) =>
    session.runs.filter(
      (run) => isAgentAnalysis(session, run) && Date.parse(run.started_at) >= from,
    );
  const usageOf = (list: Session[]): ScoutUsage =>
    list.reduce<ScoutUsage>(
      (acc, session) => {
        for (const run of inWindow(session)) {
          acc.analyses += 1;
          const total = run.usage?.total_tokens;
          if (typeof total === "number" && Number.isFinite(total)) acc.tokens += total;
        }
        return acc;
      },
      { analyses: 0, tokens: 0 },
    );

  const own = sessions.filter((s) => !isCompetitorSession(s) && !isArchivedSession(s));
  const insightsByProduct = {} as Record<ProductId, UnifiedInsight[]>;
  const productStats = products.map((product): ProductStats => {
    const items = buildUnifiedInsights(sessions, product.id, {
      sampleDecision: options.sampleDecision,
    });
    insightsByProduct[product.id] = items;
    return {
      id: product.id,
      name: product.name,
      tracker: items.filter((i) => i.kind === "real" && i.source === "tracker").length,
      explorer: items.filter((i) => i.kind === "real" && i.source === "explorer").length,
      sample: items.filter((i) => i.kind === "sample").length,
      tokens:
        usageOf(sessionsForProduct(own, product.id)).tokens +
        usageOf(competitorSessionsFor(sessions, product.id)).tokens,
    };
  });
  return {
    window,
    insightsByProduct,
    products: productStats,
    insights: {
      tracker: productStats.reduce((n, p) => n + p.tracker, 0),
      explorer: productStats.reduce((n, p) => n + p.explorer, 0),
      sample: productStats.reduce((n, p) => n + p.sample, 0),
    },
    usage: {
      // Same session set as the Analyze cap (scoutForSession), so analyses here match capToday.
      tracker: usageOf(sessions.filter((s) => scoutForSession(s) === "tracker")),
      explorer: usageOf(sessions.filter((s) => scoutForSession(s) === "explorer")),
    },
    capToday: {
      // Exactly what usageCapStatus counts for the Analyze button (all stored sessions).
      tracker: analysesToday(stored, options.now, "tracker"),
      explorer: analysesToday(stored, options.now, "explorer"),
    },
  };
}
