import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDot,
  FastForward,
  GitPullRequest,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Shell } from "./Shell";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";
import { DeltaTable, IdeaSource, PrStatusPill, RunSourceLink, RunSourceMarker } from "./PRReview";
import { SourceMarker } from "./SourceMarker";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/use-product";
import { useSimulation } from "@/hooks/use-simulation";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { listSessions } from "@/lib/research/sessionStorage";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { latestFindings } from "@/lib/research/insights";
import { sessionsForProduct } from "@/lib/research/products";
import { competitorSessionsFor, ownSessions } from "@/lib/research/competitors";
import { getScout, type ScoutId } from "@/lib/research/scouts";
import { sampleInsightFor, sampleInsightLink } from "@/lib/research/demo/happyPath";
import {
  fastForwardRun,
  runsForFinding,
  runsForProduct,
  type SimulatedRun,
  type StageState,
  ideaSourceFor,
} from "@/lib/research/simulation";
import { effectiveRoute, effectiveTest, testDecisionOf } from "@/lib/research/testDecisions";
import { suggestedRouteLabels, type Finding, type Session } from "@/lib/research/types";

/*
 * A/B Tests (AUTOMATED-LOOP §4.4). Pending/approved/rejected counts come from real stored
 * findings. Experiment runs, variant recordings, deltas and PRs are labeled SIMULATED demo data
 * from simulation.ts: nothing here builds, deploys or records a variant, or calls the network.
 */

const scoutStyle = (id: ScoutId) => {
  const { main, deep, tint, ring } = getScout(id).colors;
  return {
    "--scout-main": main,
    "--scout-deep": deep,
    "--scout-tint": tint,
    "--scout-ring": ring,
  } as CSSProperties;
};

/** Stage progress for a simulated run: bar, live stage label and the stage list. */
export function SimulatedStageStepper({ stage, scout }: { stage: StageState; scout: ScoutId }) {
  const percent = Math.round(stage.progress * 100);
  const color = getScout(scout).colors.main;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span aria-live="polite" className="min-w-0 text-[color:var(--muted-foreground)]">
          Stage {stage.index + 1} of {stage.stages.length}:{" "}
          <strong className="font-semibold text-[color:var(--foreground)]">{stage.label}</strong>
        </span>
        <span className="shrink-0 tabular-nums text-[color:var(--muted-foreground)]">
          {stage.done ? "Done" : `${percent}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Simulated run progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-[#ffffff14]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
      <ol
        aria-label="Simulated run stages"
        className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 sm:grid-cols-4 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none"
      >
        {stage.stages.map((item, i) => {
          const complete = stage.done || i < stage.index;
          const current = !stage.done && i === stage.index;
          return (
            <li
              key={item.label}
              aria-current={current ? "step" : undefined}
              className={`flex min-w-0 items-start gap-1.5 text-[11px] leading-snug ${
                complete || current
                  ? "text-[color:var(--foreground)]"
                  : "text-[color:var(--muted-foreground)] opacity-70"
              }`}
            >
              {complete ? (
                <CheckCircle2 aria-hidden size={12} className="mt-px shrink-0" style={{ color }} />
              ) : current ? (
                <CircleDot
                  aria-hidden
                  size={12}
                  className="mt-px shrink-0 motion-safe:animate-pulse"
                  style={{ color }}
                />
              ) : (
                <Circle aria-hidden size={12} className="mt-px shrink-0" />
              )}
              <span className="min-w-0">
                {item.label.replace(/ \(\d+% traffic\)$/, "")}
                <span className="sr-only">
                  {complete ? " (complete)" : current ? " (in progress)" : " (upcoming)"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Simulated recordings collected so far (illustrative counts; no footage exists). */
function visibleRecordings(run: SimulatedRun, stage: StageState, now: number) {
  const collect = stage.stages.findIndex((s) => /recordings/i.test(s.label));
  const next = stage.stages[collect + 1];
  const from = stage.stages[collect]?.at_ms ?? 0;
  const to = next?.at_ms ?? run.duration_ms;
  const elapsed = now - Date.parse(run.started_at);
  if (stage.done || elapsed >= to) return run.recordings.variant;
  if (collect < 0 || elapsed < from) return 0;
  return Math.max(1, Math.round((run.recordings.variant * (elapsed - from)) / (to - from)));
}

function SimulatedRecordings({
  run,
  stage,
  now,
}: {
  run: SimulatedRun;
  stage: StageState;
  now: number;
}) {
  const count = visibleRecordings(run, stage, now);
  const shown = Math.min(count, 6);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[color:var(--muted-foreground)] tabular-nums">
        Variant recordings <strong className="text-[color:var(--foreground)]">{count}</strong> /{" "}
        {run.recordings.variant} · {run.recordings.control} control
      </span>
      {count > 0 && (
        <ul
          aria-label="Variant recordings (simulated)"
          title="Placeholders. No variant was built or recorded."
          className="m-0 flex list-none flex-wrap gap-1 p-0"
        >
          {Array.from({ length: shown }, (_, i) => (
            <li
              key={i}
              className="inline-flex h-5 w-7 items-center justify-center rounded border border-dashed border-[color:var(--scout-ring)] bg-[#ffffff06]"
            >
              <Play aria-hidden size={9} className="text-[color:var(--scout-main)]" />
              <span className="sr-only">Variant {i + 1}, simulated, no footage</span>
            </li>
          ))}
          {count > shown && (
            <li className="px-1 text-[11px] text-[color:var(--muted-foreground)]">
              +{count - shown}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function TrafficSplit({ run }: { run: SimulatedRun }) {
  const variant = run.traffic_percent ?? 0;
  const control = 100 - variant;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className="text-[color:var(--muted-foreground)]">A · Control {control}%</span>
        <span className="text-[color:var(--scout-main)]">B · Variant {variant}%</span>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-[#ffffff14]"
        role="img"
        aria-label={`Simulated traffic split: ${control}% control, ${variant}% variant`}
      >
        <div className="h-full bg-[#ffffff2e]" style={{ width: `${control}%` }} />
        <div className="h-full bg-[color:var(--scout-main)]" style={{ width: `${variant}%` }} />
      </div>
      <p className="m-0 text-xs leading-snug">
        <span className="text-[color:var(--muted-foreground)]">B: </span>
        {run.test.change}
      </p>
    </div>
  );
}

export function ExperimentRunCard({
  run,
  stage,
  now,
  highlighted = false,
}: {
  run: SimulatedRun;
  stage: StageState;
  now: number;
  highlighted?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const metrics = [
    run.test.primary_metric && `Primary: ${run.test.primary_metric}`,
    run.test.guardrail_metric && `Guardrail: ${run.test.guardrail_metric}`,
  ].filter(Boolean);
  return (
    <article
      ref={ref}
      data-simulated="true"
      aria-label={`Simulated experiment: ${run.finding_title}`}
      style={scoutStyle("experimenter")}
      className={`flex min-w-0 flex-col gap-4 rounded-xl border bg-[linear-gradient(135deg,var(--scout-tint),#ffffff04)] p-4 sm:p-5 ${
        highlighted ? "border-[color:var(--scout-main)]" : "border-[color:var(--scout-ring)]"
      }`}
    >
      <header className="flex min-w-0 items-start gap-3">
        <ScoutMascot scout="experimenter" size={40} decorative halo={false} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <PrStatusPill run={run} stage={stage} />
            <SimulatedBadge detail="Client-side simulation. Nothing is built, deployed or recorded." />
            {run.sample && (
              <span className="rounded-full border border-[#ffffff2e] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                Sample loop
              </span>
            )}
          </div>
          <h3 className="m-0 text-base font-semibold leading-snug">{run.finding_title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <RunSourceMarker run={run} />
            <IdeaSource run={run} />
          </div>
        </div>
      </header>
      <SimulatedStageStepper stage={stage} scout="experimenter" />
      <TrafficSplit run={run} />
      {metrics.length > 0 && (
        <p className="m-0 text-[11px] text-[color:var(--muted-foreground)]">
          {metrics.join(" · ")}
        </p>
      )}
      <SimulatedRecordings run={run} stage={stage} now={now} />
      {stage.deltasVisible ? (
        <DeltaTable run={run} />
      ) : (
        <p className="m-0 text-xs text-[color:var(--muted-foreground)]">
          Deltas appear at “Comparing deltas”.
        </p>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ffffff12] pt-3">
        <RunSourceLink run={run} />
        {!stage.prReady && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fastForwardRun(run.id)}
            title="Demo control: jump this simulated run to PR ready"
          >
            <FastForward />
            Skip to results
          </Button>
        )}
        {stage.prReady && (
          <Button asChild size="sm" variant={run.pr.status === "open" ? "default" : "outline"}>
            <Link to="/rollouts" search={{ pr: run.id }}>
              <GitPullRequest />
              {run.pr.status === "open" ? "Review PR" : "View PR"}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </footer>
    </article>
  );
}

/** Real stored sessions for the selected product: own findings plus competitor (Explorer) ones. */
function useProductFindings() {
  const { productId, selectProduct } = useProduct();
  const [all, setAll] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    listSessions()
      .then((sessions) => live && setAll(sessions))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);
  useSessionsChanged(() => {
    listSessions()
      .then(setAll)
      .catch(() => {});
  });
  const entries = ownSessions(sessionsForProduct(all, productId)).flatMap((session) =>
    latestFindings(session).map((finding) => ({ session, finding })),
  );
  const competitorEntries = competitorSessionsFor(all, productId).flatMap((session) =>
    latestFindings(session).map((finding) => ({ session, finding })),
  );
  return { productId, selectProduct, entries, competitorEntries, loaded, error };
}
export type FindingEntry = { session: Session; finding: Finding };
const hasSuggestion = (f: Finding) => !!effectiveTest(f) || !!f.suggested_route;

export function LoadSampleButton({
  onLoad,
  variant = "outline",
}: {
  onLoad: () => void;
  variant?: "outline" | "default";
}) {
  return (
    <Button type="button" variant={variant} onClick={onLoad}>
      <Sparkles />
      Load sample loop
    </Button>
  );
}

function SectionTitle({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-center gap-2">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-[#ffffff10] px-2 py-0.5 text-xs tabular-nums text-[color:var(--muted-foreground)]">
          {count}
        </span>
      )}
      {children}
    </div>
  );
}

function FindingLink({ entry, children }: { entry: FindingEntry; children: ReactNode }) {
  return (
    <Link
      to="/insights/$sessionId/$findingId"
      params={{ sessionId: entry.session.id, findingId: entry.finding.id }}
      className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:underline"
    >
      {children}
      <ArrowRight aria-hidden size={12} />
    </Link>
  );
}

const newestFirst = (a: SimulatedRun, b: SimulatedRun) =>
  Number(!!b.happy_path) - Number(!!a.happy_path) ||
  Date.parse(b.started_at) - Date.parse(a.started_at);

export function ABTests() {
  const { productId, selectProduct, entries, competitorEntries, loaded, error } =
    useProductFindings();
  const search = useSearch({ strict: false }) as { run?: string };
  const sim = useSimulation();
  const experimenterOff = !useAgentSettings().settings.experimenter.enabled;
  const [startError, setStartError] = useState("");
  const linked = search.run ? sim.runs.find((run) => run.id === search.run) : undefined;
  // A deep link to a run shows it under its own product (once, so the picker still works).
  const adopted = useRef<string | null>(null);
  useEffect(() => {
    if (!linked?.product_id || adopted.current === linked.id) return;
    adopted.current = linked.id;
    if (linked.product_id !== productId) selectProduct(linked.product_id);
  }, [linked, productId, selectProduct]);
  const runs = runsForProduct(sim.runs, productId)
    .filter((run) => run.kind === "experiment")
    .sort(newestFirst);
  const running = runs.filter((run) => !sim.stageOf(run).done);
  const finished = runs.filter((run) => sim.stageOf(run).done);
  const pendingTests = entries.filter(
    ({ finding }) =>
      hasSuggestion(finding) &&
      finding.review_status !== "rejected" &&
      testDecisionOf(finding) === "pending" &&
      effectiveRoute(finding) === "experiment",
  );
  const approvedWaiting = [...entries, ...competitorEntries].filter(
    ({ finding }) =>
      testDecisionOf(finding) === "approved" &&
      effectiveRoute(finding) === "experiment" &&
      !runsForFinding(sim.runs, finding.id).some((run) => run.kind === "experiment"),
  );
  const rejected = entries.filter(({ finding }) => testDecisionOf(finding) === "rejected");
  // Fictional happy-path sample (Uber Eats only): offered until its test is decided.
  const sample = sampleInsightFor(productId);
  const sampleWaiting = !!sample && !sim.happyPathRun && sim.sampleDecision.decision === "pending";
  // Approved while the Experimenter was off: offer it here with the reviewer's saved edits.
  const sampleApproved =
    !!sample && !sim.happyPathRun && sim.sampleDecision.decision === "approved";
  const readyCount = approvedWaiting.length + (sampleApproved ? 1 : 0);
  const hasSample = runs.some((run) => run.sample);
  const seed = () => {
    if (productId) sim.seed(productId);
  };
  const start = ({ session, finding }: FindingEntry) => {
    setStartError("");
    try {
      sim.start(finding, "experiment", {
        product_id: productId,
        idea_source: ideaSourceFor(session),
      });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "The simulated run could not start.");
    }
  };
  const card = (run: SimulatedRun) => (
    <ExperimentRunCard
      key={run.id}
      run={run}
      stage={sim.stageOf(run)}
      now={sim.now}
      highlighted={run.id === search.run}
    />
  );
  return (
    <Shell section="A/B Tests">
      <header
        style={scoutStyle("experimenter")}
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
      >
        <ScoutMascot scout="experimenter" size={72} animated />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[28px] font-semibold leading-tight text-[#f5effb]">
              A/B Tests
            </h1>
            <SimulatedBadge
              size="md"
              detail="Runs are a client-side simulation. No variant is built, no traffic is split, nothing is deployed."
            />
          </div>
          <p className="m-0 text-sm text-[color:var(--muted-foreground)]">
            Approved tests run here. A PR follows when one finishes.
          </p>
        </div>
        {!hasSample && runs.length > 0 && <LoadSampleButton onLoad={seed} />}
      </header>

      {error && (
        <div className="error-note my-4" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Link
          to="/insights"
          className="group flex items-center gap-3 rounded-xl border border-[#c6a5ec24] bg-[#b79cda0a] p-3 text-sm no-underline transition-colors hover:border-[#c6a5ec4d]"
        >
          <Lightbulb size={16} aria-hidden className="shrink-0 text-[color:var(--primary)]" />
          <span className="min-w-0 flex-1 text-[color:var(--foreground)]">
            {!loaded ? (
              "Checking suggested tests…"
            ) : (
              <>
                <strong className="tabular-nums">{pendingTests.length}</strong> suggested{" "}
                {pendingTests.length === 1 ? "test" : "tests"} to review
              </>
            )}
          </span>
          <ArrowRight
            size={13}
            aria-hidden
            className="text-[color:var(--primary)] transition-transform group-hover:translate-x-0.5"
          />
        </Link>
        {sampleWaiting && sample && (
          <Link
            {...sampleInsightLink()}
            style={scoutStyle("experimenter")}
            className="group flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--scout-ring)] bg-[color:var(--scout-tint)] p-3 text-sm no-underline"
          >
            <ScoutMascot scout="experimenter" size={28} decorative halo={false} />
            <span className="min-w-0 flex-1 font-medium text-[color:var(--foreground)]">
              Suggested: {sample.title}
            </span>
            <SourceMarker source={sample.source} />
            <SimulatedBadge />
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--scout-main)]">
              Review
              <ArrowRight aria-hidden size={12} />
            </span>
          </Link>
        )}
      </div>

      {readyCount > 0 && (
        <>
          <SectionTitle title="Approved, ready to run" count={readyCount} />
          {startError && (
            <div className="error-note mb-3" role="alert">
              {startError}
            </div>
          )}
          {experimenterOff && (
            <p className="mb-3 text-xs text-[color:var(--muted-foreground)]" role="status">
              Experimenter is off in Settings → Scouts.
            </p>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sampleApproved && sample && (
              <li className="flex flex-col gap-2 rounded-lg border border-[#ffffff17] bg-[#ffffff06] p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {sample.title}
                    <SimulatedBadge />
                  </span>
                  <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                    B: {(sim.sampleDecision.edited_test ?? sample.suggested_test).change}
                  </span>
                  <Link
                    {...sampleInsightLink()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:underline"
                  >
                    Open insight
                    <ArrowRight aria-hidden size={12} />
                  </Link>
                </div>
                <Button
                  type="button"
                  disabled={experimenterOff}
                  title={experimenterOff ? "Experimenter is off in Settings → Scouts." : undefined}
                  onClick={() => sim.approveSample(sim.sampleDecision.edited_test)}
                >
                  <Play />
                  Start test
                </Button>
              </li>
            )}
            {approvedWaiting.map((entry) => {
              const test = effectiveTest(entry.finding);
              return (
                <li
                  key={entry.finding.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#ffffff17] bg-[#ffffff06] p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{entry.finding.title}</span>
                    {test?.change && (
                      <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                        B: {test.change}
                      </span>
                    )}
                    <FindingLink entry={entry}>Open insight</FindingLink>
                  </div>
                  <Button
                    type="button"
                    disabled={experimenterOff}
                    title={
                      experimenterOff ? "Experimenter is off in Settings → Scouts." : undefined
                    }
                    onClick={() => start(entry)}
                  >
                    <Play />
                    Start test
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {runs.length === 0 ? (
        readyCount === 0 && (
          <section
            aria-label="No experiments yet"
            style={scoutStyle("experimenter")}
            className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--scout-ring)] px-5 py-10 text-center"
          >
            <ScoutMascot scout="experimenter" size={64} />
            <h2 className="m-0 text-lg font-semibold">No experiments yet</h2>
            <p className="m-0 text-sm text-[color:var(--muted-foreground)]">
              Approve a suggested test in Insights to start one.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <LoadSampleButton onLoad={seed} variant="default" />
              <Button asChild variant="outline">
                <Link to="/insights">
                  Insights
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </section>
        )
      ) : (
        <>
          {running.length > 0 && (
            <>
              <SectionTitle title="Running now" count={running.length} />
              <div className="flex flex-col gap-4">{running.map(card)}</div>
            </>
          )}
          {finished.length > 0 && (
            <>
              <SectionTitle title="Finished" count={finished.length} />
              <div className="flex flex-col gap-4">{finished.map(card)}</div>
            </>
          )}
        </>
      )}

      {rejected.length > 0 && (
        <details className="mt-8 rounded-lg border border-[#ffffff12] bg-[#ffffff03] p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Rejected tests{" "}
            <span className="tabular-nums text-[color:var(--muted-foreground)]">
              ({rejected.length})
            </span>
          </summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {rejected.map((entry) => {
              const route = effectiveRoute(entry.finding);
              return (
                <li key={entry.finding.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <XCircle aria-hidden size={14} className="text-[color:var(--muted-foreground)]" />
                  <span className="min-w-0 flex-1 font-medium">{entry.finding.title}</span>
                  <span className="rounded-full border border-[#ffffff2e] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                    {suggestedRouteLabels[route]}
                  </span>
                  <FindingLink entry={entry}>
                    <RotateCcw aria-hidden size={12} />
                    Reconsider
                  </FindingLink>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </Shell>
  );
}
