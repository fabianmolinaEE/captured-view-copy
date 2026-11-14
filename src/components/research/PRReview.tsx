import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  FileCode2,
  FilePlus2,
  GitMerge,
  GitPullRequest,
  Lightbulb,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "./SimulatedBadge";
import { MergeCelebration } from "./MergeCelebration";
import { SourceMarker } from "./SourceMarker";
import { getScout } from "@/lib/research/scouts";
import { orderAgainTest } from "@/lib/research/demo/happyPath";
import {
  ILLUSTRATIVE_NOTE,
  deltaLabels,
  diffStats,
  prReview,
  type SimulatedAnalytics,
  type SimulatedDelta,
  type SimulatedFileDiff,
  type SimulatedRun,
  type StageState,
} from "@/lib/research/simulation";

/*
 * PR review for a SIMULATED run (AUTOMATED-LOOP §3): illustrative file diffs, control vs variant
 * analytics, deltas and the linked insight. Merge and Close only update the simulated record;
 * no repository is connected and nothing is deployed.
 */

/** Source marker for a run's insight: explicit, else derived from its idea source. */
export function RunSourceMarker({ run }: { run: SimulatedRun }) {
  const source = run.insight_source ?? run.idea_source?.scout;
  return source ? <SourceMarker source={source} /> : null;
}

export function PrStatusPill({ run, stage }: { run: SimulatedRun; stage: StageState }) {
  const base =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight";
  if (!stage.done)
    return (
      <span className={`${base} border-[color:var(--scout-ring)] text-[color:var(--scout-main)]`}>
        <CircleDot aria-hidden size={11} className="motion-safe:animate-pulse" />
        Running
      </span>
    );
  if (run.pr.status === "merged")
    return (
      <span className={`${base} border-[#a4ddc866] bg-[#91d5b719] text-[#bfe9d8]`}>
        <CheckCircle2 aria-hidden size={11} />
        Merged
      </span>
    );
  if (run.pr.status === "closed")
    return (
      <span className={`${base} border-[#ffffff2e] text-[color:var(--muted-foreground)]`}>
        <XCircle aria-hidden size={11} />
        Closed
      </span>
    );
  return (
    <span className={`${base} border-[#c6a7f166] bg-[#c6a7f114] text-[#e0cbff]`}>
      <GitPullRequest aria-hidden size={11} />
      PR ready
    </span>
  );
}

/** Link to the run's source insight (real or sample), or a note for unlinked sample loops. */
export function RunSourceLink({ run }: { run: SimulatedRun }) {
  if (run.session_id && run.finding_id)
    return (
      <Link
        to="/insights/$sessionId/$findingId"
        params={{ sessionId: run.session_id, findingId: run.finding_id }}
        className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[color:var(--primary)] hover:underline"
      >
        <Lightbulb aria-hidden size={13} className="shrink-0" />
        <span className="truncate">Source insight: {run.finding_title}</span>
        <ArrowRight aria-hidden size={12} className="shrink-0" />
      </Link>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted-foreground)]">
      <Lightbulb aria-hidden size={13} />
      Sample loop · no linked insight
    </span>
  );
}

/** "Idea from Explorer · DoorDash public footage (sample)". */
export function IdeaSource({ run }: { run: SimulatedRun }) {
  if (!run.idea_source) return null;
  const scout = getScout(run.idea_source.scout);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[color:var(--muted-foreground)]">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: scout.colors.main }}
      />
      <span className="min-w-0">
        Idea from <strong style={{ color: scout.colors.main }}>{scout.name}</strong> ·{" "}
        {run.idea_source.label}
      </span>
    </span>
  );
}

const IllustrativeTag = () => (
  <span className="rounded-full border border-dashed border-[#efc68f8c] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#f3d3a4]">
    {ILLUSTRATIVE_NOTE}
  </span>
);

const roleLabel: Record<NonNullable<SimulatedDelta["role"]>, string> = {
  primary: "Primary",
  guardrail: "Guardrail",
  secondary: "Secondary",
};

/** Compact control vs variant table. Illustrative deltas stay neutral (AUTOMATED-LOOP §3). */
export function DeltaTable({
  run,
  metrics = run.deltas,
  caption,
  showRole = false,
}: {
  run: SimulatedRun;
  metrics?: SimulatedDelta[];
  caption?: string;
  showRole?: boolean;
}) {
  const labels = deltaLabels(run.kind);
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {caption ?? (run.kind === "experiment" ? "Sample deltas" : "Sample verification")}
        <IllustrativeTag />
      </figcaption>
      <div className="overflow-x-auto rounded-lg border border-[#ffffff17]">
        <table className="w-full min-w-[360px] border-collapse text-left text-xs">
          <thead className="bg-[#ffffff08] text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Metric
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {labels.control}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {labels.variant}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((delta) => (
              <tr key={delta.metric} className="border-t border-[#ffffff10]">
                <th scope="row" className="px-3 py-2 font-normal leading-snug">
                  {delta.metric}
                  {showRole && delta.role && (
                    <span className="ml-1.5 rounded-full bg-[#ffffff0d] px-1.5 py-px text-[10px] text-[color:var(--muted-foreground)]">
                      {roleLabel[delta.role]}
                    </span>
                  )}
                </th>
                <td className="px-2 py-2 tabular-nums text-[color:var(--muted-foreground)]">
                  {delta.control}
                </td>
                <td className="px-2 py-2 tabular-nums">{delta.variant}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-[color:var(--muted-foreground)]">
                  {delta.change}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ---- Files changed ----

const lineStyles = {
  add: "bg-[#4fd18b14] text-[#d4f5e2]",
  del: "bg-[#ff7a7a14] text-[#f7cdcd]",
  context: "text-[color:var(--muted-foreground)]",
} as const;
const signStyles = { add: "text-[#4fd18b]", del: "text-[#ff8a8a]", context: "" } as const;

function FileDiffView({ diff }: { diff: SimulatedFileDiff }) {
  return (
    <section
      aria-label={`Diff: ${diff.path}`}
      className="min-w-0 overflow-hidden rounded-lg border border-[#ffffff17]"
    >
      <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[#ffffff12] bg-[#ffffff08] px-3 py-2 font-mono text-[11px]">
        <span className="min-w-0 flex-1 break-all">{diff.path}</span>
        {diff.status === "added" && (
          <span className="rounded-full bg-[#4fd18b1f] px-1.5 py-px font-sans text-[10px] text-[#9fe6bf]">
            New
          </span>
        )}
        <span className="tabular-nums text-[#4fd18b]">+{diff.additions}</span>
        <span className="tabular-nums text-[#ff8a8a]">−{diff.deletions}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[11px] leading-[1.6]">
          {diff.hunks.map((hunk, h) => (
            <tbody key={h}>
              <tr>
                <td colSpan={4} className="bg-[#5aa9ff12] px-3 py-1 text-[#9cc8ff] whitespace-pre">
                  {hunk.header}
                </td>
              </tr>
              {hunk.lines.map((line, i) => (
                <tr key={i} data-line={line.type} className={lineStyles[line.type]}>
                  <td className="w-9 select-none px-2 text-right tabular-nums opacity-50">
                    {line.old ?? ""}
                  </td>
                  <td className="w-9 select-none px-2 text-right tabular-nums opacity-50">
                    {line.new ?? ""}
                  </td>
                  <td className={`w-4 select-none text-center ${signStyles[line.type]}`}>
                    {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                  </td>
                  <td className="whitespace-pre pr-4">{line.text || " "}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function FilesChanged({ diffs }: { diffs: SimulatedFileDiff[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const shown = selected ? diffs.filter((d) => d.path === selected) : diffs;
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
      <nav aria-label="Changed files" className="min-w-0">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          <li>
            <button
              type="button"
              aria-pressed={selected === null}
              onClick={() => setSelected(null)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                selected === null
                  ? "bg-[#ffffff12] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted-foreground)] hover:bg-[#ffffff08]"
              }`}
            >
              All files ({diffs.length})
            </button>
          </li>
          {diffs.map((diff) => {
            const name = diff.path.split("/").pop() ?? diff.path;
            const active = selected === diff.path;
            return (
              <li key={diff.path}>
                <button
                  type="button"
                  aria-pressed={active}
                  title={diff.path}
                  onClick={() => setSelected(diff.path)}
                  className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left font-mono text-[11px] ${
                    active
                      ? "bg-[#ffffff12] text-[color:var(--foreground)]"
                      : "text-[color:var(--muted-foreground)] hover:bg-[#ffffff08]"
                  }`}
                >
                  {diff.status === "added" ? (
                    <FilePlus2 aria-hidden size={12} className="shrink-0 text-[#4fd18b]" />
                  ) : (
                    <FileCode2 aria-hidden size={12} className="shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="shrink-0 tabular-nums text-[#4fd18b]">+{diff.additions}</span>
                  {diff.deletions > 0 && (
                    <span className="shrink-0 tabular-nums text-[#ff8a8a]">−{diff.deletions}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col gap-3">
        {shown.map((diff) => (
          <FileDiffView key={diff.path} diff={diff} />
        ))}
      </div>
    </div>
  );
}

// ---- Analytics, deltas, insight ----

function Analytics({ run, analytics }: { run: SimulatedRun; analytics: SimulatedAnalytics }) {
  const labels = deltaLabels(run.kind);
  const facts: [string, string][] = [
    [labels.control, `${analytics.sample_sizes.control.toLocaleString("en-US")} ${analytics.unit}`],
    [labels.variant, `${analytics.sample_sizes.variant.toLocaleString("en-US")} ${analytics.unit}`],
    ...(analytics.traffic_percent !== undefined
      ? ([["Traffic", `${analytics.traffic_percent}% variant`]] as [string, string][])
      : []),
    ["Window", analytics.window_label],
  ];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([term, value]) => (
          <div key={term} className="rounded-lg border border-[#ffffff12] bg-[#ffffff05] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
              {term}
            </dt>
            <dd className="m-0 text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <DeltaTable
        run={run}
        metrics={analytics.metrics}
        caption="Control vs variant · sample"
        showRole
      />
    </div>
  );
}

function Deltas({ metrics }: { metrics: SimulatedDelta[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        Deltas <IllustrativeTag />
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
        {metrics.map((delta) => (
          <li
            key={delta.metric}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-[#ffffff14] bg-[#ffffff05] p-3"
          >
            <span className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--muted-foreground)]">
              <span className="min-w-0 truncate">{delta.metric}</span>
              {delta.role && <span className="shrink-0 opacity-80">{roleLabel[delta.role]}</span>}
            </span>
            <strong className="text-2xl font-semibold tabular-nums text-[color:var(--foreground)]">
              {delta.change}
            </strong>
            <span className="text-[11px] tabular-nums text-[color:var(--muted-foreground)]">
              {delta.control} → {delta.variant}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkedInsight({ run }: { run: SimulatedRun }) {
  const rows: [string, string | undefined][] = [
    [
      run.kind === "experiment" ? "Hypothesis" : "Fix",
      run.kind === "experiment" ? run.test.hypothesis : run.test.change,
    ],
    [run.kind === "experiment" ? "Primary metric" : "Checked with", run.test.primary_metric],
    ["Guardrail", run.test.guardrail_metric],
  ];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <RunSourceLink run={run} />
        <RunSourceMarker run={run} />
      </div>
      <IdeaSource run={run} />
      <dl className="m-0 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[110px_minmax(0,1fr)]">
        {rows
          .filter(([, value]) => value?.trim())
          .map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-[color:var(--muted-foreground)]">{term}</dt>
              <dd className="m-0 mb-1 leading-snug sm:mb-0">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

type Tab = "files" | "analytics" | "deltas" | "insight";

export interface PRReviewProps {
  run: SimulatedRun;
  stage: StageState;
  /** Returns an error message, or null on success. */
  onMerge: () => string | null;
  onClose: () => string | null;
}

/** Review panel: files changed, analytics, deltas and linked insight, then merge or close. */
export function PRReview({ run, stage, onMerge, onClose }: PRReviewProps) {
  const id = useId();
  const review = prReview(run);
  const stats = diffStats(review.diffs);
  const [tab, setTab] = useState<Tab>("files");
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const open = run.pr.status === "open";
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "files", label: "Files changed", count: stats.files },
    { id: "analytics", label: "Analytics" },
    { id: "deltas", label: "Deltas" },
    { id: "insight", label: "Insight" },
  ];
  const merge = () => {
    const failure = onMerge();
    setError(failure ?? "");
    if (!failure) setCelebrating(true);
  };
  const close = () => setError(onClose() ?? "");
  const passed = review.checks.filter((c) => c.status === "passed").length;
  return (
    <div
      data-simulated="true"
      aria-label={`PR review: ${run.pr.title}`}
      role="region"
      className="flex min-w-0 flex-col gap-3 border-t border-[#ffffff12] pt-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
        <span className="tabular-nums">
          {stats.files} {stats.files === 1 ? "file" : "files"} ·{" "}
          <span className="text-[#4fd18b]">+{stats.additions}</span>{" "}
          <span className="text-[#ff8a8a]">−{stats.deletions}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 aria-hidden size={12} className="text-[#a4ddc8]" />
          {passed}/{review.checks.length} checks passed
        </span>
        <SimulatedBadge
          label="Illustrative"
          detail="Diffs, checks and analytics are illustrative. No repository is connected."
        />
      </div>
      {run.happy_path && JSON.stringify(run.test) !== JSON.stringify(orderAgainTest()) && (
        <p className="m-0 text-[11px] text-[color:var(--muted-foreground)]">
          You edited the test. This sample PR and its analytics stay fixed.
        </p>
      )}
      <div
        role="tablist"
        aria-label="PR review"
        className="flex gap-1 overflow-x-auto border-b border-[#ffffff12]"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${id}-${item.id}-tab`}
            aria-selected={tab === item.id}
            aria-controls={`${id}-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium ${
              tab === item.id
                ? "border-[color:var(--scout-main)] text-[color:var(--foreground)]"
                : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-[#ffffff10] px-1.5 text-[10px] tabular-nums">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-${tab}`}
        aria-labelledby={`${id}-${tab}-tab`}
        className="min-w-0"
      >
        {tab === "files" && <FilesChanged diffs={review.diffs} />}
        {tab === "analytics" && <Analytics run={run} analytics={review.analytics} />}
        {tab === "deltas" && <Deltas metrics={review.analytics.metrics} />}
        {tab === "insight" && <LinkedInsight run={run} />}
      </div>
      {celebrating && (
        <MergeCelebration title={run.pr.title} onDone={() => setCelebrating(false)} />
      )}
      <footer className="flex flex-col gap-2 border-t border-[#ffffff12] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11px] text-[color:var(--muted-foreground)]">
          {open
            ? "Simulated: merging changes no repository."
            : `${run.pr.status === "merged" ? "Merged" : "Closed"}${
                (run.pr.merged_at ?? run.pr.updated_at)
                  ? ` ${new Date(run.pr.merged_at ?? run.pr.updated_at!).toLocaleString()}`
                  : ""
              } · simulated`}
        </span>
        {open && stage.prReady && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={close}>
              <XCircle />
              Close
            </Button>
            <Button type="button" size="sm" onClick={merge}>
              <GitMerge />
              Merge
            </Button>
          </div>
        )}
      </footer>
      {error && (
        <div className="error-note" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
