import type { Session } from "./types";
export const UBER_EATS_SOURCE = "Uber Eats";
export const MAX_PUBLIC_CLIP_MS = 5 * 60 * 1000;
/**
 * Public Uber Eats walkthroughs. Titles and creators were checked against YouTube's public oEmbed
 * endpoint on November 13, 2026 (all five resolved, which also indicates embedding is allowed).
 * Dates are the creator's published or titled date where known. Candidates only: nothing here is a
 * stored session, counter or finding until a person previews it and saves a reference.
 */
export const uberEatsCandidates = [
  {
    id: "EFCmkDTBYck",
    title: "How to Use Uber Eats for the First Time",
    creator: "4kEasyGuide",
    date: "June 2026",
    context: "Ordering walkthrough; indexed description covers login through checkout.",
  },
  {
    id: "XRYyOhmIdfg",
    title: "How To Order Food On Uber Eats",
    creator: "How to Everything",
    date: "January 2026",
    context: "Customer ordering tutorial; footage and usable segments need review.",
  },
  {
    id: "oDcQjVREO5w",
    title: "Uber Eats: how to order food (Russian-language tutorial)",
    creator: "HardReset_info Ukraine",
    date: "October 2025",
    context:
      "Short tutorial with published chapters covering address, cart, delivery and payment. Narration and app language are Russian.",
  },
  {
    id: "BgETPxj78Eo",
    title: "Join us as we explore the Uber Eats app",
    creator: "Bridges Helpdesk and Technical Assistance Center",
    date: "Linked in an August 2024 review",
    context: "VoiceOver demonstration. Screen-reader gestures are not ordinary touch behavior.",
  },
  {
    id: "Xkv-FUvspg0",
    title: "How to Use Uber Eats on iPhone & Android - Walkthrough Tutorial",
    creator: "TechZG Guides",
    date: "August 2020",
    context: "Older backup. Do not describe historical UI as the current app.",
  },
] as const;
export type PublicCandidate = (typeof uberEatsCandidates)[number];
export const youtubeURL = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/**
 * YouTube's public poster image for a video, used for highlight thumbnails of public sessions
 * (their saved video_blob is empty, so a <video> element would only paint black).
 *
 * This is NOT the frame at the highlight timestamp: the public thumbnail endpoint only serves a
 * few fixed images per video (the poster plus three auto-picked frames), and an exact
 * frame-at-time image would need the Data API or downloading the video, neither of which we do.
 * Cards overlay the highlight timestamp on the poster instead. Null for a malformed id.
 */
export const youtubeThumbnailUrl = (
  id: string,
  quality: "mqdefault" | "hqdefault" = "mqdefault",
) => (/^[\w-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/${quality}.jpg` : null);
export function youtubeId(url: string) {
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("v");
    return parsed.protocol === "https:" &&
      parsed.hostname === "www.youtube.com" &&
      parsed.pathname === "/watch" &&
      id &&
      /^[\w-]{11}$/.test(id) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      parsed.searchParams.size === 1 &&
      !parsed.hash
      ? id
      : null;
  } catch {
    return null;
  }
}
export function validatePublicClip(durationMs: number, startMs: number, endMs: number) {
  if (
    ![durationMs, startMs, endMs].every(Number.isFinite) ||
    durationMs <= 0 ||
    durationMs > 3600000 ||
    startMs < 0 ||
    endMs <= startMs ||
    endMs > durationMs ||
    endMs - startMs > MAX_PUBLIC_CLIP_MS
  )
    throw new Error(
      "Choose a segment inside the verified video duration, up to five minutes long.",
    );
}
export function createPublicSession(
  candidate: PublicCandidate,
  durationMs: number,
  startMs: number,
  endMs: number,
): Session {
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
    source_app: UBER_EATS_SOURCE,
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
    },
  };
}
export const isPublicVideo = (session: Session) =>
  session.capture_mode === "public_youtube" && !!session.public_video;
export const evidenceDuration = (session: Session) =>
  session.public_video
    ? session.public_video.end_ms - session.public_video.start_ms
    : session.duration_ms;

/** Fixed, actionable text for the IFrame API onError codes (2, 5, 100, 101, 150, 153). */
export function youtubePlaybackError(code: number) {
  if (code === 101 || code === 150)
    return "This video's owner has disabled playback on other websites. Watch it on YouTube, or attach the original video file to play it here.";
  if (code === 153)
    return "YouTube could not verify this site's identity (error 153). Reload the player; if it persists, watch on YouTube or attach the original video file.";
  if (code === 100)
    return "This video is unavailable: it was removed or made private. Watch on YouTube to confirm, or attach the original video file.";
  if (code === 2)
    return "The player rejected this video's ID or settings (error 2). Reload the player or watch on YouTube.";
  if (code === 5)
    return "This browser's video player could not play this video (error 5). Reload the player or watch on YouTube.";
  return "This video could not play. Reload the player, watch on YouTube, or attach the original video file.";
}

/** Fixed caveats for specific public candidates. Shown wherever their sessions or insights appear. */
const candidateCaveats: Partial<Record<string, string>> = {
  "Xkv-FUvspg0": "Historical UI (2020)",
};
/**
 * Short label for a public candidate, e.g. "Historical UI (2020)" for the 2020 walkthrough.
 * Undefined when the candidate needs no caveat.
 */
export const candidateNote = (candidateId: string | undefined) =>
  candidateId ? candidateCaveats[candidateId] : undefined;

/**
 * Labels to show next to a public-video session: the candidate caveat, and an honest
 * "found no insights" note when the latest completed public-video run returned zero findings.
 */
export function publicSessionNotes(
  session: Pick<Session, "public_video" | "runs" | "findings">,
): string[] {
  if (!session.public_video) return [];
  const notes: string[] = [];
  const caveat = candidateNote(session.public_video.video_id);
  if (caveat) notes.push(caveat);
  const latest = session.runs.filter((run) => run.status === "completed").at(-1);
  if (
    latest?.mode === "public_video" &&
    !session.findings.some((finding) => finding.analysis_run_id === latest.id)
  )
    notes.push(
      `${session.public_video.competitor_of ? "Explorer" : "Tracker"} found no insights in this clip`,
    );
  return notes;
}

/**
 * "Tracker run · pre-generated Nov 13" for imported pre-generated runs; undefined otherwise.
 * Competitor footage (e.g. the imported DoorDash Explorer runs) reads "Explorer run · …".
 * The single source of this label: cards, recordings, session pages and insight details all use
 * it. Explorer is decided by competitor provenance OR the bundled Explorer runs file, so an
 * Explorer session lacking `competitor_of` still reads "Explorer" everywhere.
 */
export function pregeneratedLabel(
  session: Pick<Session, "pregenerated"> & {
    public_video?: { competitor_of?: unknown } | undefined;
  },
) {
  const pregenerated = session.pregenerated;
  const generated = pregenerated?.generated_at;
  if (!generated) return undefined;
  const explorer =
    !!session.public_video?.competitor_of || pregenerated.source === "doordash-explorer-runs";
  const scout = explorer ? "Explorer" : "Tracker";
  const date = new Date(generated);
  return Number.isNaN(date.getTime())
    ? `${scout} run · pre-generated`
    : `${scout} run · pre-generated ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}
