import {
  insightSourceLabels,
  videoCountLabel,
  type InsightSource,
} from "@/lib/research/unifiedInsights";
import { sourceColorList } from "@/lib/research/sourceMarkers";
import type { ScoutId } from "@/lib/research/scouts";
import { ScoutMascot } from "./ScoutMascot";

const sourceScouts: Record<InsightSource, readonly ScoutId[]> = {
  tracker: ["tracker"],
  explorer: ["explorer"],
  both: ["tracker", "explorer"],
};

/** Accessible name for a source's hero avatars, e.g. "Found by Tracker and Explorer". */
function sourceHeroLabel(source: InsightSource, competitor?: string | null) {
  const base =
    source === "both" ? "Found by Tracker and Explorer" : `Found by ${insightSourceLabels[source]}`;
  return source === "explorer" && competitor ? `${base}, watching ${competitor}` : base;
}

/**
 * The scout(s) behind an insight as small hero avatars: the blue Tracker, the green Explorer, or
 * both overlapping. Static on purpose (lists stay calm); a dark disc sits behind each halo so an
 * overlapping pair never shows through.
 */
export function SourceHeroes({
  source,
  competitor,
  size = 30,
  decorative = false,
  className = "",
}: {
  source: InsightSource;
  competitor?: string | null | undefined;
  /** Avatar width in px. */
  size?: number;
  /** Hide from assistive tech when a visible label already names the source. */
  decorative?: boolean;
  className?: string;
}) {
  const ids = sourceScouts[source];
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": sourceHeroLabel(source, competitor) };
  return (
    <span
      data-heroes={source}
      className={`inline-flex shrink-0 items-center ${className}`}
      {...a11y}
    >
      {ids.map((id, index) => (
        <span
          key={id}
          className="relative inline-flex"
          style={index ? { marginLeft: -Math.round(size * 0.32) } : undefined}
        >
          {/* Matches the mascot's halo circle (cx 48, cy 50, r 41 on a 96×92 canvas). */}
          <span
            aria-hidden
            className="absolute rounded-full bg-[#1c1832]"
            style={{ left: "7%", right: "7%", top: "10%", bottom: "1%" }}
          />
          <ScoutMascot scout={id} size={size} decorative className="relative" />
        </span>
      ))}
    </span>
  );
}

/**
 * Source marker for an insight: blue (Tracker only), green (Explorer only) or blue+green (both).
 * The label is always visible text, so color is never the only signal. With `heroSize`, the
 * colored dots become the scouts' hero avatars, which carry the accessible "Found by …" name.
 */
export function SourceMarker({
  source,
  competitor,
  heroSize,
  className = "",
}: {
  source: InsightSource;
  /** Appended for Explorer items, e.g. "Explorer · DoorDash". */
  competitor?: string | null | undefined;
  /** Show hero avatars of this width (px) instead of colored dots. */
  heroSize?: number;
  className?: string;
}) {
  const colors = sourceColorList(source);
  const text =
    source === "explorer" && competitor
      ? `${insightSourceLabels.explorer} · ${competitor}`
      : insightSourceLabels[source];
  return (
    <span
      data-source={source}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium ${className}`}
      style={{ color: source === "both" ? "#cfe9f0" : colors[0] }}
    >
      {heroSize ? (
        <>
          <SourceHeroes source={source} competitor={competitor} size={heroSize} />
          <span aria-hidden>{text}</span>
        </>
      ) : (
        <>
          <span aria-hidden className="inline-flex -space-x-1">
            {colors.map((color) => (
              <span
                key={color}
                className="h-2.5 w-2.5 rounded-full ring-2 ring-[#201d38]"
                style={{ background: color }}
              />
            ))}
          </span>
          {text}
        </>
      )}
    </span>
  );
}

/** "from N videos". A single video carries a tooltip: one recording, frequency not measured. */
export function VideoCount({
  count,
  illustrative = false,
  source,
  className = "",
}: {
  count: number;
  /** Fictional sample counts get an explicit "sample" qualifier. */
  illustrative?: boolean;
  /** Explorer counts are competitor clips: inspiration, never user frequency. */
  source?: InsightSource | undefined;
  className?: string;
}) {
  const note = illustrative
    ? "Illustrative sample count, not real recordings."
    : source === "explorer"
      ? "Competitor footage: a pattern to learn from, not a user frequency."
      : count === 1
        ? "Single-session observation (n = 1). Frequency across users is not measured yet."
        : undefined;
  return (
    <span
      data-testid="video-count"
      title={note}
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-[#ffffff24] px-2 py-0.5 text-[11px] text-[#d8cce9] ${className}`}
    >
      {videoCountLabel(count)}
      {illustrative ? " · sample" : ""}
      {note ? <span className="sr-only"> ({note})</span> : null}
    </span>
  );
}
