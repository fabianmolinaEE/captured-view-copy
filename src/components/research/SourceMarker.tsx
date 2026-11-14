import {
  insightSourceLabels,
  videoCountLabel,
  type InsightSource,
} from "@/lib/research/unifiedInsights";
import { sourceColorList } from "@/lib/research/sourceMarkers";

/**
 * Colored source marker for an insight: blue (Tracker only), green (Explorer only) or blue+green
 * (both). The label is always visible text, so color is never the only signal.
 */
export function SourceMarker({
  source,
  competitor,
  className = "",
}: {
  source: InsightSource;
  /** Appended for Explorer items, e.g. "Explorer · DoorDash". */
  competitor?: string | null | undefined;
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
