import type { ProductId } from "./products";
import { validatePublicClip, youtubeURL } from "./publicVideo";
import type { Session } from "./types";

/**
 * Explorer scout: competitors' public product footage, analyzed for patterns worth adopting or
 * avoiding in OUR product. Competitor sessions are never own-product evidence and are excluded
 * from own-product Insights priorities, counts and Evaluation metrics.
 */
export const DOORDASH_SOURCE = "DoorDash";

export interface Competitor {
  /** Stable key, also used as the session source_app. */
  source: string;
  name: string;
}
export const DOORDASH: Competitor = { source: DOORDASH_SOURCE, name: "DoorDash" };

const competitors: Partial<Record<ProductId, Competitor>> = { "uber-eats": DOORDASH };

/** uber-eats → DoorDash; checkout → null (no competitor configured). */
export function competitorOf(productId: ProductId | null | undefined): Competitor | null {
  return (productId && competitors[productId]) || null;
}
export const competitorSources: readonly string[] = [DOORDASH_SOURCE];

/** True for competitor footage, by explicit provenance or a known competitor source name. */
export function isCompetitorSession(
  session: Pick<Session, "source_app"> & { public_video?: { competitor_of?: unknown } | undefined },
) {
  return !!session.public_video?.competitor_of || competitorSources.includes(session.source_app);
}
/** Own-product sessions only (competitor footage removed). */
export const ownSessions = <
  T extends Pick<Session, "source_app"> & {
    public_video?: { competitor_of?: unknown } | undefined;
  },
>(
  sessions: T[],
) => sessions.filter((session) => !isCompetitorSession(session));

/** Competitor sessions linked to a product, for the Competitors (Explorer) tab. */
export function competitorSessionsFor(sessions: Session[], productId: ProductId | null) {
  const competitor = competitorOf(productId);
  if (!productId || !competitor) return [];
  return sessions.filter(
    (session) =>
      isCompetitorSession(session) &&
      (session.public_video?.competitor_of === productId ||
        (!session.public_video?.competitor_of && session.source_app === competitor.source)),
  );
}
/** The product a competitor session is compared against, if any. */
export function competitorProductOf(session: Session): ProductId | null {
  if (session.public_video?.competitor_of) return session.public_video.competitor_of;
  return session.source_app === DOORDASH_SOURCE ? "uber-eats" : null;
}

export interface CompetitorCandidate {
  id: string;
  title: string;
  creator: string;
  date: string;
  context: string;
}
/**
 * Public DoorDash walkthroughs (titles/creators from YouTube oEmbed, Nov 13 2026). Candidates
 * only: each must be previewed, its duration read from the player and its footage reviewed
 * before a reference is saved. Nothing here is a stored session, counter or finding.
 */
export const doorDashCandidates: readonly CompetitorCandidate[] = [
  {
    id: "Q-41ykn9eMI",
    title: "How to Use DoorDash App 2026 | Complete Beginner's Guide to Ordering Food & Groceries",
    creator: "Online Money",
    date: "Titled 2026",
    context: "Beginner walkthrough of ordering food and groceries. Review usable segments first.",
  },
  {
    id: "GvejoxdR0Vo",
    title: "How to Order Food Through DoorDash in 2026 | Step-by-Step Delivery Guide",
    creator: "DiziSight",
    date: "Titled 2026",
    context: "Step-by-step ordering guide. Check that the app screen is readable.",
  },
  {
    id: "POS585Ok0Jg",
    title: "How To Use DoorDash - Complete Beginner's Guide",
    creator: "Howfinity",
    date: "Date not verified",
    context: "Beginner guide; app version may be older than the current UI.",
  },
  {
    id: "VfirQD7YTqM",
    title: "How to Order Food on DoorDash 2024",
    creator: "lemme help",
    date: "Titled 2024",
    context: "Older backup. Do not describe historical UI as the current app.",
  },
];

/** Builds a competitor public-video reference (same format as Uber Eats references). */
export function createCompetitorSession(
  candidate: CompetitorCandidate,
  productId: ProductId,
  durationMs: number,
  startMs: number,
  endMs: number,
): Session {
  const competitor = competitorOf(productId);
  if (!competitor) throw new Error("This product has no competitor configured.");
  validatePublicClip(durationMs, startMs, endMs);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: candidate.title,
    created_at: now,
    captured_at: now,
    duration_ms: durationMs,
    video_blob: new Blob(),
    mime_type: "video/youtube",
    extension: "youtube",
    capture_mode: "public_youtube",
    source_app: competitor.source,
    scenario_config: [],
    loading_delay_ms: 0,
    status: "captured",
    consent_confirmed: true,
    event_count: 0,
    events: [],
    findings: [],
    issues: [],
    matches: [],
    runs: [],
    video_start_offset_ms: 0,
    public_video: {
      url: youtubeURL(candidate.id),
      video_id: candidate.id,
      creator: candidate.creator,
      published_label: candidate.date,
      context: candidate.context,
      start_ms: startMs,
      end_ms: endMs,
      duration_verified: true,
      footage_reviewed_at: now,
      competitor_of: productId,
    },
  };
}
