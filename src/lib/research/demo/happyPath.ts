import type { ProductId } from "../products";
import type { SuggestedTest } from "../types";

/**
 * FICTIONAL SAMPLE INSIGHT for the demo happy path (AUTOMATED-LOOP.md §3 labeled simulation).
 *
 * "Order again on the home screen" is an illustrative example, like the pitch-night
 * "reorder past orders = 2x spend" story. It was NOT produced by analyzing any footage and no
 * stored recording or YouTube video shows it. It never enters IndexedDB research sessions,
 * Insights priorities, Evaluation metrics or real counters. Every surface that shows it must
 * carry the visible `SAMPLE_BADGE`. Its evidence is an illustrative storyboard (descriptors the
 * UI draws as simple inline SVG/CSS frames), never highlights on real footage.
 *
 * Addressing: the detail URL is `/insights/sample/order-again` (sessionId "sample", findingId
 * "order-again"). Real session ids are UUIDs, so "sample" can never collide with one.
 */
export const SAMPLE_SESSION_ID = "sample";
export const ORDER_AGAIN_FINDING_ID = "order-again";
/** Stable unified-list key: `${SAMPLE_SESSION_ID}:${ORDER_AGAIN_FINDING_ID}`. */
export const ORDER_AGAIN_KEY = `${SAMPLE_SESSION_ID}:${ORDER_AGAIN_FINDING_ID}`;
/** Visible badge text (same wording as simulation.ts SIMULATED_BADGE). */
export const SAMPLE_BADGE = "Simulated demo";
/** Compact secondary label for stats and storyboards. */
export const SAMPLE_NOTE = "Sample · illustrative, not real footage";
export const HAPPY_PATH_TRAFFIC_PERCENT = 20;

export interface SampleObservation {
  scout: "tracker" | "explorer";
  /** Where the (fictional) observation comes from, e.g. "Your Uber Eats sessions (sample)". */
  source_label: string;
  text: string;
}
export interface SampleStat {
  label: string;
  value: string;
  illustrative: true;
}
/** What a storyboard frame draws. The UI maps each to a simple inline SVG/CSS phone frame. */
export type StoryboardScene =
  | "home_scroll"
  | "search_restaurant"
  | "rebuild_basket"
  | "competitor_reorder_row"
  | "variant_reorder_row";
export interface StoryboardFrame {
  id: string;
  /** Who "saw" it: Tracker (own product), Explorer (competitor) or the proposed variant. */
  scout: "tracker" | "explorer" | "variant";
  scene: StoryboardScene;
  /** Phone screen title drawn in the frame, e.g. "Home". */
  screen: string;
  /** One-line caption under the frame. */
  caption: string;
  /** Illustrative timestamp label inside the storyboard, e.g. "0:12". Not a real video time. */
  time_label: string;
  illustrative: true;
}
export interface SampleInsight {
  id: typeof ORDER_AGAIN_FINDING_ID;
  session_id: typeof SAMPLE_SESSION_ID;
  key: typeof ORDER_AGAIN_KEY;
  kind: "sample";
  simulated: true;
  sample: true;
  badge: typeof SAMPLE_BADGE;
  product_id: ProductId;
  source: "both";
  title: string;
  /** One-line summary for cards. */
  summary: string;
  category: string;
  screen: string;
  /** Illustrative confidence used only for ordering; never shown as a model score. */
  confidence: number;
  route: "experiment";
  observations: { tracker: SampleObservation; explorer: SampleObservation };
  /** Illustrative cohort framing (AUTOMATED-LOOP §1.2). */
  seen_in: { sessions: number; window: number; label: string; illustrative: true };
  /** Distinct (fictional) supporting videos: your sessions + competitor clips. */
  video_count: number;
  video_breakdown: { tracker: number; explorer: number; illustrative: true };
  stats: SampleStat[];
  suggested_test: SuggestedTest;
  traffic_percent: number;
  storyboard: StoryboardFrame[];
  storyboard_note: string;
  competitor: string;
}

const suggestedTest: SuggestedTest = {
  hypothesis:
    'If we show an "Order again" button for recent orders on the home screen, then returning customers reorder more often because they no longer scroll and search to find last week\'s order.',
  change: `Add an "Order again" row with recent orders and a one-tap Reorder button at the top of the home screen for ${HAPPY_PATH_TRAFFIC_PERCENT}% of traffic. Control keeps the current home screen.`,
  primary_metric: "reorders per user",
  guardrail_metric: "checkout errors",
  target_screen: "Home",
};

const storyboard: StoryboardFrame[] = [
  {
    id: "tracker-scroll",
    scout: "tracker",
    scene: "home_scroll",
    screen: "Home",
    caption: "Scrolls past promos to find last week's restaurant",
    time_label: "0:04",
    illustrative: true,
  },
  {
    id: "tracker-search",
    scout: "tracker",
    scene: "search_restaurant",
    screen: "Search",
    caption: "Gives up scrolling and searches by name",
    time_label: "0:21",
    illustrative: true,
  },
  {
    id: "tracker-basket",
    scout: "tracker",
    scene: "rebuild_basket",
    screen: "Menu",
    caption: "Rebuilds the same basket item by item",
    time_label: "0:38",
    illustrative: true,
  },
  {
    id: "explorer-doordash",
    scout: "explorer",
    scene: "competitor_reorder_row",
    screen: "DoorDash home",
    caption: "DoorDash puts “Order again” at the top of home",
    time_label: "0:06",
    illustrative: true,
  },
  {
    id: "variant",
    scout: "variant",
    scene: "variant_reorder_row",
    screen: "Home (variant)",
    caption: "Proposed: one tap to reorder from home",
    time_label: "—",
    illustrative: true,
  },
];

const orderAgain: SampleInsight = {
  id: ORDER_AGAIN_FINDING_ID,
  session_id: SAMPLE_SESSION_ID,
  key: ORDER_AGAIN_KEY,
  kind: "sample",
  simulated: true,
  sample: true,
  badge: SAMPLE_BADGE,
  product_id: "uber-eats",
  source: "both",
  title: "Order again on the home screen",
  summary: "Returning users hunt for last week's order. DoorDash puts it one tap away.",
  category: "Engagement",
  screen: "Home",
  confidence: 0.86,
  route: "experiment",
  observations: {
    tracker: {
      scout: "tracker",
      source_label: "Your Uber Eats sessions (sample)",
      text: "Returning users scroll the home screen and search to find last week's order, then rebuild the basket by hand.",
    },
    explorer: {
      scout: "explorer",
      source_label: "DoorDash public footage (sample)",
      text: 'DoorDash shows an "Order again" row with recent orders at the top of its home screen.',
    },
  },
  seen_in: {
    sessions: 14,
    window: 50,
    label: "Seen in 14 of 50 sessions · sample",
    illustrative: true,
  },
  video_count: 16,
  video_breakdown: { tracker: 14, explorer: 2, illustrative: true },
  stats: [
    { label: "Seen in", value: "14 of 50 sessions", illustrative: true },
    { label: "Time to find last order", value: "38 s median", illustrative: true },
    { label: "Competitor pattern", value: "DoorDash home", illustrative: true },
  ],
  suggested_test: suggestedTest,
  traffic_percent: HAPPY_PATH_TRAFFIC_PERCENT,
  storyboard,
  storyboard_note: "Illustrative storyboard · not real footage",
  competitor: "DoorDash",
};

/** Deep copy so callers can never mutate the bundled sample. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The sample insight, or null when the product has none (only Uber Eats has one). */
export function sampleInsightFor(productId: ProductId | null | undefined): SampleInsight | null {
  return productId === orderAgain.product_id ? copy(orderAgain) : null;
}
/** All sample insights (currently one). */
export const sampleInsights = (): SampleInsight[] => [copy(orderAgain)];
/** The approved-test snapshot used when the sample test starts a simulated run. */
export const orderAgainTest = (): SuggestedTest => ({ ...suggestedTest });

/** True when a detail-route param pair addresses a sample insight rather than a stored session. */
export function isSampleInsightRoute(sessionId: string, findingId?: string) {
  return (
    sessionId === SAMPLE_SESSION_ID && (findingId === undefined || findingId === orderAgain.id)
  );
}
/** Detail-route lookup: `/insights/$sessionId/$findingId` → sample insight, or null. */
export function getSampleInsight(sessionId: string, findingId: string): SampleInsight | null {
  return sessionId === SAMPLE_SESSION_ID && findingId === orderAgain.id ? copy(orderAgain) : null;
}
/** Router link target for the sample detail page. */
export const sampleInsightLink = () =>
  ({
    to: "/insights/$sessionId/$findingId",
    params: { sessionId: SAMPLE_SESSION_ID, findingId: ORDER_AGAIN_FINDING_ID },
  }) as const;

/**
 * Real pre-generated findings featured in the demo alongside the sample (unaltered model output
 * from the bundled runs; present only after the automatic import). Tracker-only: "Hidden minimum
 * order threshold" (Uber Eats run). Explorer-only: "Cart Complement Recommendations" (DoorDash run).
 */
export const FEATURED_TRACKER_FINDING_ID = "822882b7-fc89-4cce-88a0-5625cf8ef575";
export const FEATURED_EXPLORER_FINDING_ID = "763474ac-b1d8-40a9-9a0f-994bb42a93af";
/** Display order on the demo: Both (sample), Tracker only, Explorer only. */
export const featuredOrder: readonly string[] = [
  ORDER_AGAIN_FINDING_ID,
  FEATURED_TRACKER_FINDING_ID,
  FEATURED_EXPLORER_FINDING_ID,
];
/** 0-based featured rank, or null for non-featured findings. */
export function featuredRank(findingId: string): number | null {
  const index = featuredOrder.indexOf(findingId);
  return index === -1 ? null : index;
}
