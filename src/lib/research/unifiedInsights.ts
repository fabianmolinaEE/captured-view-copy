import { competitorOf, competitorSessionsFor } from "./competitors";
import {
  featuredRank,
  sampleInsightFor,
  sampleInsightLink,
  type SampleInsight,
} from "./demo/happyPath";
import { latestFindings } from "./insights";
import { sessionsForProduct, type ProductId } from "./products";
import { effectiveRoute, effectiveTest, testDecisionOf } from "./testDecisions";
import type { Finding, Session, SuggestedRoute, SuggestedTest } from "./types";

/**
 * One Insights view for a product (team decision, Nov 13): own-product findings (Tracker) and
 * competitor findings (Explorer) side by side, each tagged with its source, plus the labeled
 * fictional happy-path sample. This is a VIEW only: own-product priorities, counts and
 * Evaluation metrics still come from aggregateInsights()/sessionsForProduct(), which exclude
 * competitor footage and samples.
 */
export type InsightSource = "tracker" | "explorer" | "both";
export type InsightSourceFilter = "all" | InsightSource;
export type UnifiedDecision = "pending" | "approved" | "rejected";

export const insightSourceLabels: Record<InsightSource, string> = {
  tracker: "Tracker",
  explorer: "Explorer",
  both: "Tracker + Explorer",
};
/** Marker colors: Tracker blue, Explorer green, Both blue+green. */
export const insightSourceColors: Record<InsightSource, readonly string[]> = {
  tracker: ["blue"],
  explorer: ["green"],
  both: ["blue", "green"],
};

export interface UnifiedLink {
  to: "/insights/$sessionId/$findingId";
  params: { sessionId: string; findingId: string };
}
interface UnifiedBase {
  /** Stable key: `${sessionId}:${findingId}`. */
  key: string;
  source: InsightSource;
  /** Distinct supporting sessions/videos (1 for a real single-session finding). */
  video_count: number;
  session_ids: string[];
  title: string;
  /** Card one-liner. Real items: the model description verbatim (UI may truncate). */
  summary: string;
  category: string;
  screen: string;
  /** Ordering only. */
  confidence: number;
  review_status: Finding["review_status"];
  decision: UnifiedDecision;
  /** Pending review, or accepted with the test/fix decision still pending. */
  needs_attention: boolean;
  route: SuggestedRoute;
  suggested_test: SuggestedTest | null;
  /** One line: the change in the suggested test (or fix), when there is one. */
  suggested_test_summary: string | null;
  link: UnifiedLink;
  /** Demo display rank (0 = sample, 1 = featured Tracker, 2 = featured Explorer), else null. */
  featured_rank: number | null;
  /** Competitor name for Explorer items, e.g. "DoorDash". */
  competitor: string | null;
}
export interface RealUnifiedInsight extends UnifiedBase {
  kind: "real";
  source: "tracker" | "explorer";
  finding: Finding;
  session: Session;
}
export interface SampleUnifiedInsight extends UnifiedBase {
  kind: "sample";
  /** Always true: fictional, show the "Simulated demo" badge. */
  simulated: true;
  sample: SampleInsight;
}
export type UnifiedInsight = RealUnifiedInsight | SampleUnifiedInsight;

export interface SampleDecisionInput {
  review_status: Finding["review_status"];
  decision: UnifiedDecision;
}
export interface BuildUnifiedOptions {
  /** Stored decision for the sample (simulation store); pending when omitted. */
  sampleDecision?: SampleDecisionInput | undefined;
  /** Include the fictional sample (default true). */
  includeSample?: boolean | undefined;
}

const needsAttention = (review: Finding["review_status"], decision: UnifiedDecision) =>
  review === "pending" || (review === "accepted" && decision === "pending");

function realItem(
  session: Session,
  finding: Finding,
  source: "tracker" | "explorer",
  competitor: string | null,
): RealUnifiedInsight {
  const test = effectiveTest(finding) ?? null;
  const route = effectiveRoute(finding);
  const decision = testDecisionOf(finding);
  const change =
    test?.change?.trim() || (route === "fix" ? finding.recommendation?.trim() : "") || "";
  return {
    kind: "real",
    key: `${session.id}:${finding.id}`,
    source,
    video_count: 1,
    session_ids: [session.id],
    title: finding.title,
    summary: finding.description,
    category: finding.category,
    screen: finding.screen ?? "",
    confidence: finding.confidence,
    review_status: finding.review_status,
    decision,
    needs_attention: needsAttention(finding.review_status, decision),
    route,
    suggested_test: test,
    suggested_test_summary: change || null,
    link: {
      to: "/insights/$sessionId/$findingId",
      params: { sessionId: session.id, findingId: finding.id },
    },
    featured_rank: featuredRank(finding.id),
    competitor,
    finding,
    session,
  };
}

/** The sample as a unified item (pending unless a stored decision is given). */
export function sampleItem(
  sample: SampleInsight,
  decision: SampleDecisionInput = { review_status: "pending", decision: "pending" },
): SampleUnifiedInsight {
  const link = sampleInsightLink();
  return {
    kind: "sample",
    simulated: true,
    key: sample.key,
    source: sample.source,
    video_count: sample.video_count,
    session_ids: [sample.session_id],
    title: sample.title,
    summary: sample.summary,
    category: sample.category,
    screen: sample.screen,
    confidence: sample.confidence,
    review_status: decision.review_status,
    decision: decision.decision,
    needs_attention: needsAttention(decision.review_status, decision.decision),
    route: sample.route,
    suggested_test: { ...sample.suggested_test },
    suggested_test_summary: sample.suggested_test.change,
    link: { to: link.to, params: { ...link.params } },
    featured_rank: featuredRank(sample.id),
    competitor: sample.competitor,
    sample,
  };
}

/**
 * Featured demo items first in their fixed order (sample, Tracker, Explorer), whatever their
 * review state; then needs-attention, confidence (desc) and key for stability.
 */
export function compareUnified(a: UnifiedInsight, b: UnifiedInsight) {
  const rank = (item: UnifiedInsight) => item.featured_rank ?? Number.POSITIVE_INFINITY;
  return (
    (rank(a) === rank(b) ? 0 : rank(a) < rank(b) ? -1 : 1) ||
    Number(b.needs_attention) - Number(a.needs_attention) ||
    b.confidence - a.confidence ||
    a.key.localeCompare(b.key)
  );
}

/**
 * True for a finding from a bundled pre-generated run that the curated demo no longer shows
 * (user request, Nov 13: only the three featured insights). The import migration deletes these;
 * this keeps a browser that has not migrated yet from flashing them. Findings from the user's
 * own later runs on such a session are not hidden.
 */
export function isRetiredDemoFinding(session: Session, finding: Finding) {
  return (
    !!session.pregenerated?.run_ids.includes(finding.analysis_run_id) &&
    featuredRank(finding.id) === null
  );
}

/**
 * True for a whole pre-generated session the curated demo no longer uses: it holds only bundled
 * runs and none of its findings is featured. The import migration deletes these; counts skip them
 * so a browser that has not migrated yet shows the same totals as one that has.
 */
export function isRetiredDemoSession(session: Session) {
  const marker = session.pregenerated;
  if (!marker) return false;
  return (
    session.runs.every((run) => marker.run_ids.includes(run.id)) &&
    session.findings.every((finding) => isRetiredDemoFinding(session, finding))
  );
}

/** Latest-run findings the curated demo still shows (see `isRetiredDemoFinding`). */
export function shownFindings(session: Session) {
  return latestFindings(session).filter((finding) => !isRetiredDemoFinding(session, finding));
}

/**
 * Unified list for a product: latest-run findings from own-product sessions (Tracker) and from
 * competitor sessions linked to the product (Explorer), plus the sample when the product has one.
 * For the Uber Eats demo this is exactly three items: the sample, then the curated Tracker and
 * Explorer findings, plus any analyses the user ran themselves.
 */
export function buildUnifiedInsights(
  sessions: Session[],
  productId: ProductId | null,
  options: BuildUnifiedOptions = {},
): UnifiedInsight[] {
  if (!productId) return [];
  const competitor = competitorOf(productId)?.name ?? null;
  const items: UnifiedInsight[] = [];
  for (const session of sessionsForProduct(sessions, productId))
    for (const finding of latestFindings(session))
      if (!isRetiredDemoFinding(session, finding))
        items.push(realItem(session, finding, "tracker", null));
  for (const session of competitorSessionsFor(sessions, productId))
    for (const finding of latestFindings(session))
      if (!isRetiredDemoFinding(session, finding))
        items.push(realItem(session, finding, "explorer", competitor ?? session.source_app));
  const sample = options.includeSample === false ? null : sampleInsightFor(productId);
  if (sample) items.push(sampleItem(sample, options.sampleDecision));
  return items.sort(compareUnified);
}

export interface UnifiedFilter {
  /** "tracker"/"explorer" also match "both" items (they carry that scout's evidence). */
  source?: InsightSourceFilter | undefined;
  /** Minimum distinct supporting videos (default 1). */
  minVideos?: number | undefined;
  /** Optional review-status filter. */
  status?: Finding["review_status"] | "all" | undefined;
}
export function matchesSource(item: Pick<UnifiedInsight, "source">, filter: InsightSourceFilter) {
  if (filter === "all") return true;
  if (filter === "both") return item.source === "both";
  return item.source === filter || item.source === "both";
}
export function filterUnified(items: UnifiedInsight[], filter: UnifiedFilter = {}) {
  const min = Math.max(1, filter.minVideos ?? 1);
  return items.filter(
    (item) =>
      matchesSource(item, filter.source ?? "all") &&
      item.video_count >= min &&
      (!filter.status || filter.status === "all" || item.review_status === filter.status),
  );
}
/** Choices for a "from N+ videos" filter: 1 plus each distinct count present, ascending. */
export function videoCountThresholds(items: Pick<UnifiedInsight, "video_count">[]) {
  return [...new Set([1, ...items.map((item) => item.video_count)])].sort((a, b) => a - b);
}
/** "from 1 video" / "from 16 videos". */
export const videoCountLabel = (count: number) => `from ${count} video${count === 1 ? "" : "s"}`;
/** Featured demo items (sample, Tracker-only, Explorer-only) in display order, when present. */
export function featuredUnified(items: UnifiedInsight[]) {
  return items
    .filter((item) => item.featured_rank !== null)
    .sort((a, b) => a.featured_rank! - b.featured_rank!);
}
/** Maps legacy `?tab=` values: "competitors" → Explorer filter; anything else → all. */
export function sourceFilterFromTab(tab: unknown): InsightSourceFilter {
  if (tab === "competitors" || tab === "explorer") return "explorer";
  if (tab === "tracker" || tab === "both") return tab;
  return "all";
}
/** Lookup for the detail route: unified item by session + finding id. */
export function findUnified(items: UnifiedInsight[], sessionId: string, findingId: string) {
  return items.find((item) => item.key === `${sessionId}:${findingId}`) ?? null;
}
/** Counts per source for filter chips. */
export function sourceCounts(items: UnifiedInsight[]) {
  return {
    all: items.length,
    tracker: items.filter((i) => i.source === "tracker").length,
    explorer: items.filter((i) => i.source === "explorer").length,
    both: items.filter((i) => i.source === "both").length,
  };
}
