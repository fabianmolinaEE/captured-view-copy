import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Film, Sparkles } from "lucide-react";
import { useProduct } from "@/hooks/use-product";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { useSimulation } from "@/hooks/use-simulation";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { listSessions } from "@/lib/research/sessionStorage";
import { aggregateInsights } from "@/lib/research/insights";
import { sessionsForProduct } from "@/lib/research/products";
import { ownSessions } from "@/lib/research/competitors";
import { candidateNote, pregeneratedLabel } from "@/lib/research/publicVideo";
import { SAMPLE_NOTE } from "@/lib/research/demo/happyPath";
import {
  buildUnifiedInsights,
  matchesSource,
  videoCountThresholds,
  type InsightSourceFilter,
  type UnifiedInsight,
} from "@/lib/research/unifiedInsights";
import { duration, label, type Session } from "@/lib/research/types";
import { Button } from "@/components/ui/button";
import { Shell, PageHeading } from "./Shell";
import { SimulatedBadge } from "./SimulatedBadge";
import { RouteBadge } from "./SuggestedTestPanel";
import { SourceMarker, VideoCount } from "./SourceMarker";
import { decisionState, sourceAccent } from "@/lib/research/sourceMarkers";

type StatusFilter = "all" | "attention" | "accepted" | "rejected";

const sourceOptions: { id: InsightSourceFilter; name: string }[] = [
  { id: "all", name: "All" },
  { id: "tracker", name: "Tracker" },
  { id: "explorer", name: "Explorer" },
  { id: "both", name: "Both" },
];
const statusOptions: { id: StatusFilter; name: string }[] = [
  { id: "all", name: "All" },
  { id: "attention", name: "Needs you" },
  { id: "accepted", name: "Accepted" },
  { id: "rejected", name: "Rejected" },
];

const selectClass =
  "h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary";
const chipClass = (on: boolean) =>
  `h-8 rounded-full border px-3 text-xs ${
    on
      ? "border-primary bg-accent text-primary"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

function DecisionBadge({ item }: { item: UnifiedInsight }) {
  const state = decisionState(item);
  return (
    <span
      className={`status-badge ${state.tone === "done" ? "reviewed" : ""} ${state.tone === "muted" ? "opacity-70" : ""}`}
    >
      {state.text}
    </span>
  );
}

/** Short provenance tag for real items (pre-generated run / competitor pattern). */
function provenance(item: UnifiedInsight): string[] {
  if (item.kind === "sample") return [];
  const notes: string[] = [];
  if (item.source === "explorer") notes.push("Competitor pattern");
  const caveat = candidateNote(item.session.public_video?.video_id);
  if (caveat) notes.push(caveat);
  if (item.session.pregenerated?.run_ids.includes(item.finding.analysis_run_id)) {
    const text = pregeneratedLabel(item.session);
    if (text) notes.push(text);
  }
  return notes;
}

/**
 * One insight block. No thumbnail: the block leads with source, title and value. The title link
 * is stretched over the block (::after overlay), so the whole block opens the insight with a
 * single link and one tab stop.
 */
export function UnifiedInsightCard({
  item,
  belowThreshold = false,
  source = "all",
}: {
  item: UnifiedInsight;
  belowThreshold?: boolean;
  /** Current source filter, carried to the detail page so its back link keeps it. */
  source?: InsightSourceFilter;
}) {
  const sample = item.kind === "sample" ? item.sample : null;
  const notes = provenance(item);
  return (
    <article
      aria-label={item.title}
      data-source={item.source}
      data-kind={item.kind}
      data-simulated={sample ? "true" : undefined}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#ffffff1a] bg-[#ffffff06] p-4 pl-5 transition-colors hover:border-[#c6a7f159] hover:bg-[#c6a7f10a] sm:p-5 sm:pl-6"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: sourceAccent(item.source) }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SourceMarker source={item.source} competitor={item.competitor} />
        <VideoCount count={item.video_count} illustrative={!!sample} source={item.source} />
        {sample && <SimulatedBadge detail={SAMPLE_NOTE} className="relative z-10 cursor-help" />}
        <span className="text-[11px] capitalize text-muted-foreground">{label(item.category)}</span>
        <span className="ml-auto">
          <DecisionBadge item={item} />
        </span>
      </div>
      <h2 className="mt-2.5 text-base font-semibold leading-snug text-[#f0e8f9]">
        <Link
          to={item.link.to}
          params={item.link.params}
          search={source === "all" ? {} : { source }}
          className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] group-hover:underline focus-visible:underline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary focus-visible:after:outline-solid"
        >
          {item.title}
        </Link>
      </h2>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {item.summary}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <RouteBadge route={item.route} />
        {item.suggested_test_summary ? (
          <span className="line-clamp-1 min-w-0 flex-1 basis-56">
            {item.suggested_test_summary}
          </span>
        ) : (
          <span className="flex-1">No test suggested yet</span>
        )}
      </div>
      {(sample || notes.length > 0 || belowThreshold) && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {sample && <span>{sample.seen_in.label}</span>}
          {notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
          {belowThreshold && <span>Below confidence threshold</span>}
        </div>
      )}
      <ArrowRight
        aria-hidden
        size={16}
        className="absolute right-4 top-1/2 hidden -translate-y-1/2 text-primary opacity-0 transition-opacity group-hover:opacity-100 sm:block"
      />
    </article>
  );
}

/** Demo order: featured items (sample, Tracker-only, Explorer-only) first, then the rest. */
function featuredFirst(items: UnifiedInsight[]) {
  return [...items].sort((a, b) => (a.featured_rank ?? 99) - (b.featured_rank ?? 99));
}

export function Insights({
  source: sourceProp,
  onSourceChange,
}: {
  /** Source filter; the route maps legacy `/insights?tab=competitors` to "explorer". */
  source?: InsightSourceFilter;
  onSourceChange?: (source: InsightSourceFilter) => void;
} = {}) {
  const controlledSource = sourceProp;
  const { productId } = useProduct();
  const { settings } = useAgentSettings();
  const { sampleDecision } = useSimulation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [localSource, setLocalSource] = useState<InsightSourceFilter>(controlledSource ?? "all");
  const source = controlledSource ?? localSource;
  const setSource = (next: InsightSourceFilter) => {
    setLocalSource(next);
    onSourceChange?.(next);
  };
  const [minVideosChoice, setMinVideos] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showBelow, setShowBelow] = useState(false);
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  useSessionsChanged(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  });

  const items = buildUnifiedInsights(sessions, productId, { sampleDecision });
  const thresholds = videoCountThresholds(items);
  // A choice from another product (or a vanished count) falls back to "Any".
  const minVideos = thresholds.includes(minVideosChoice) ? minVideosChoice : 1;
  // Counts reached only by the fictional sample are labeled, so the filter never reads as real frequency.
  const realCounts = new Set(
    items.filter((item) => item.kind === "real").map((i) => i.video_count),
  );
  const minConfidence = settings.tracker.min_confidence;
  const isBelow = (item: UnifiedInsight) => item.kind === "real" && item.confidence < minConfidence;
  const matching = items.filter(
    (item) =>
      matchesSource(item, source) &&
      item.video_count >= minVideos &&
      (status === "all" ||
        (status === "attention" ? item.needs_attention : item.review_status === status)),
  );
  const below = matching.filter(isBelow);
  const shown = featuredFirst(showBelow ? matching : matching.filter((item) => !isBelow(item)));
  // Own-product priorities only: competitor footage and samples never count (aggregateInsights).
  const groups = aggregateInsights(ownSessions(sessionsForProduct(sessions, productId)));
  const filtered = source !== "all" || minVideos > 1 || status !== "all";

  return (
    <Shell section="Insights">
      <PageHeading title="Insights" description="What your users and competitors show you." />
      {error && (
        <div className="error-note my-4" role="alert">
          {error}
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Source">
          {sourceOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              aria-pressed={source === option.id}
              className={chipClass(source === option.id)}
              onClick={() => setSource(option.id)}
            >
              {option.name}
              <span className="ml-1.5 opacity-70">
                {items.filter((item) => matchesSource(item, option.id)).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status">
          {statusOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              aria-pressed={status === option.id}
              className={chipClass(status === option.id)}
              onClick={() => setStatus(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          Videos
          <select
            className={selectClass}
            value={minVideos}
            onChange={(e) => setMinVideos(Number(e.target.value))}
          >
            {thresholds.map((count) => (
              <option key={count} value={count}>
                {count === 1
                  ? "Any"
                  : `${count}+${[...realCounts].some((n) => n >= count) ? "" : " (sample)"}`}
              </option>
            ))}
          </select>
        </label>
        {below.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showBelow}
            onClick={() => setShowBelow((value) => !value)}
            title={`Tracker setting: confidence ≥ ${Math.round(minConfidence * 100)}%`}
          >
            {showBelow ? "Hide" : "Show"} {below.length} below threshold
          </Button>
        )}
      </div>

      {!loaded ? (
        <div className="empty-sessions">
          <p>Opening your insights…</p>
        </div>
      ) : error ? (
        <div className="empty-sessions">
          <h2>Insights could not be loaded.</h2>
          <p>Refresh to try again. Nothing was deleted.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-sessions insights-empty">
          <Sparkles size={28} className="text-primary" />
          <h2>{items.length ? "No insights match these filters." : "No insights yet."}</h2>
          {items.length ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSource("all");
                setStatus("all");
                setMinVideos(1);
                setShowBelow(true);
              }}
            >
              Clear filters
            </Button>
          ) : (
            <p>Analyze a recording to get the first one.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3" aria-label="Insight list" role="list">
          {shown.map((item) => (
            <div role="listitem" key={item.key}>
              <UnifiedInsightCard item={item} belowThreshold={isBelow(item)} source={source} />
            </div>
          ))}
        </div>
      )}

      {loaded && !error && groups.length > 0 && !filtered && (
        <details className="mt-8 rounded-xl border border-[#ffffff1a] p-4 text-xs">
          <summary className="cursor-pointer font-medium">
            Priorities across your sessions ({groups.length})
          </summary>
          <p className="mt-2 text-muted-foreground">
            Accepted own-product insights only. Estimated triage score, not measured impact.
          </p>
          <ul className="mt-3 grid gap-2">
            {groups.map((group) => (
              <li key={group.key} className="flex flex-wrap items-center gap-2">
                <strong className="font-mono text-primary">{group.priority}</strong>
                <span className="flex-1">{group.title}</span>
                <span className="text-muted-foreground">
                  {group.affected} of {group.eligible} sessions
                </span>
                {group.evidence.slice(0, 3).map(({ session, finding }) => (
                  <Link
                    key={finding.id}
                    to="/insights/$sessionId/$findingId"
                    params={{ sessionId: session.id, findingId: finding.id }}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Film size={12} />
                    {duration(finding.timestamp_ms)}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="insights-footnote">
        Confidence is the model's own estimate. Competitor patterns never count toward your metrics.
      </p>
    </Shell>
  );
}
