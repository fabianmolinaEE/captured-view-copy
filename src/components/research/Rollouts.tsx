import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ChevronDown, GitBranch, Lightbulb, Wrench } from "lucide-react";
import { Shell } from "./Shell";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";
import { LoadSampleButton, SimulatedStageStepper } from "./ABTests";
import { PRReview, PrStatusPill, RunSourceLink, RunSourceMarker } from "./PRReview";
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
import {
  diffStats,
  ideaSourceFor,
  prReview,
  runsForFinding,
  runsForProduct,
  type SimulatedRun,
  type StageState,
} from "@/lib/research/simulation";
import { effectiveRoute, effectiveTest, testDecisionOf } from "@/lib/research/testDecisions";
import type { Finding, Session } from "@/lib/research/types";

/*
 * Rollouts: the PRs (AUTOMATED-LOOP §4.4). PRs, fix runs, diffs and deltas are labeled
 * SIMULATED demo data from simulation.ts. Merge and Close only update the simulated record:
 * no repository is connected and nothing is deployed. Fixer (bug fixes) is kept but secondary.
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

function PrCard({
  run,
  stage,
  expanded,
  onToggle,
  onMerge,
  onClose,
}: {
  run: SimulatedRun;
  stage: StageState;
  expanded: boolean;
  onToggle: () => void;
  onMerge: () => string | null;
  onClose: () => string | null;
}) {
  const scout = getScout(run.scout);
  const stats = diffStats(prReview(run).diffs);
  const ref = useRef<HTMLElement>(null);
  const panelId = `pr-${run.id}`;
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView?.({ block: "nearest" });
    // Only on first mount: deep links (?pr=) open and reveal their PR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <article
      ref={ref}
      data-simulated="true"
      aria-label={`Simulated PR: ${run.pr.title}`}
      style={scoutStyle(run.scout)}
      className={`flex min-w-0 flex-col gap-3 rounded-xl border border-[color:var(--scout-ring)] bg-[linear-gradient(135deg,var(--scout-tint),#ffffff04)] p-4 ${
        run.pr.status === "closed" ? "opacity-70" : ""
      }`}
    >
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <ScoutMascot scout={run.scout} size={40} decorative halo={false} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <PrStatusPill run={run} stage={stage} />
              <SimulatedBadge detail="Simulated PR. No repository is connected." />
              {run.sample && (
                <span className="rounded-full border border-[#ffffff2e] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                  Sample loop
                </span>
              )}
            </div>
            <h3 className="m-0 text-base font-semibold leading-snug">{run.pr.title}</h3>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[color:var(--muted-foreground)]">
              <span className="font-semibold text-[color:var(--scout-main)]">
                Drafted by {scout.name}
              </span>
              <span>{run.kind === "experiment" ? "A/B test" : "Bug fix"}</span>
              <RunSourceMarker run={run} />
              <span className="inline-flex min-w-0 items-center gap-1 font-mono">
                <GitBranch aria-hidden size={11} className="shrink-0" />
                <span className="truncate">{run.pr.branch}</span>
              </span>
              <span className="tabular-nums">
                <span className="text-[#4fd18b]">+{stats.additions}</span>{" "}
                <span className="text-[#ff8a8a]">−{stats.deletions}</span>
              </span>
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={expanded ? "outline" : "default"}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="shrink-0 self-start sm:self-center"
        >
          {expanded ? "Hide" : run.pr.status === "open" ? "Review PR" : "View PR"}
          <ChevronDown aria-hidden className={expanded ? "rotate-180" : ""} />
        </Button>
      </header>
      {expanded && (
        <div id={panelId}>
          <PRReview run={run} stage={stage} onMerge={onMerge} onClose={onClose} />
        </div>
      )}
    </article>
  );
}

function FixRunCard({ run, stage }: { run: SimulatedRun; stage: StageState }) {
  return (
    <article
      data-simulated="true"
      aria-label={`Simulated fix in progress: ${run.finding_title}`}
      style={scoutStyle("fixer")}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-[color:var(--scout-ring)] bg-[#ffffff05] p-4"
    >
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <ScoutMascot scout="fixer" size={28} decorative halo={false} />
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold">{run.finding_title}</h3>
        <SimulatedBadge detail="Client-side simulation. No code is written or deployed." />
        <PrStatusPill run={run} stage={stage} />
      </header>
      <SimulatedStageStepper stage={stage} scout="fixer" />
      <RunSourceLink run={run} />
    </article>
  );
}

type FindingEntry = { session: Session; finding: Finding };
function useProductEntries() {
  const { productId, selectProduct } = useProduct();
  const [all, setAll] = useState<Session[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    listSessions()
      .then((sessions) => live && setAll(sessions))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);
  useSessionsChanged(() => {
    listSessions()
      .then(setAll)
      .catch(() => {});
  });
  const entries: FindingEntry[] = [
    ...ownSessions(sessionsForProduct(all, productId)),
    ...competitorSessionsFor(all, productId),
  ].flatMap((session) => latestFindings(session).map((finding) => ({ session, finding })));
  return { productId, selectProduct, entries, error };
}

const statusOrder = { open: 0, merged: 1, closed: 2 } as const;

export function Rollouts() {
  const { productId, selectProduct, entries, error } = useProductEntries();
  const search = useSearch({ strict: false }) as { pr?: string };
  const sim = useSimulation();
  const fixerOff = !useAgentSettings().settings.fixer.enabled;
  const [startError, setStartError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(search.pr ?? null);
  const linked = search.pr ? sim.runs.find((run) => run.id === search.pr) : undefined;
  // A deep link to a PR opens it under its own product (once, so the picker still works).
  const adopted = useRef<string | null>(null);
  useEffect(() => {
    if (!linked?.product_id || adopted.current === linked.id) return;
    adopted.current = linked.id;
    if (linked.product_id !== productId) selectProduct(linked.product_id);
  }, [linked, productId, selectProduct]);
  const runs = runsForProduct(sim.runs, productId);
  const prs = runs
    .filter((run) => sim.stageOf(run).prReady)
    .sort(
      // The demo PR keeps its top slot (it does not jump down while its merge celebration plays).
      (a, b) =>
        Number(!!b.happy_path) - Number(!!a.happy_path) ||
        statusOrder[a.pr.status] - statusOrder[b.pr.status] ||
        Date.parse(b.started_at) - Date.parse(a.started_at),
    );
  // The demo PR opens by default when nothing was deep-linked.
  const defaultOpen = prs.find((run) => run.happy_path && run.pr.status === "open")?.id ?? null;
  const openId = expanded ?? (search.pr ? null : defaultOpen);
  // Pin the default so the panel (and its merge celebration) stays open after merging.
  useEffect(() => {
    if (expanded === null && !search.pr && defaultOpen) setExpanded(defaultOpen);
  }, [expanded, search.pr, defaultOpen]);
  const fixing = runs.filter((run) => run.kind === "fix" && !sim.stageOf(run).done);
  const experimenting = runs.filter((run) => run.kind === "experiment" && !sim.stageOf(run).done);
  const followRun = experimenting.find((run) => run.happy_path) ?? experimenting[0];
  const waitingFixes = entries.filter(
    ({ finding }) =>
      testDecisionOf(finding) === "approved" &&
      effectiveRoute(finding) === "fix" &&
      !runsForFinding(sim.runs, finding.id).some((run) => run.kind === "fix"),
  );
  const openCount = prs.filter((run) => run.pr.status === "open").length;
  const hasSample = runs.some((run) => run.sample);
  const seed = () => {
    if (productId) sim.seed(productId);
  };
  const guard = (fn: () => unknown) => () => {
    try {
      fn();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "The simulated PR could not be updated.";
    }
  };
  const startFix = ({ session, finding }: FindingEntry) => {
    setStartError("");
    try {
      sim.start(finding, "fix", { product_id: productId, idea_source: ideaSourceFor(session) });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "The simulated fix could not start.");
    }
  };
  const toggle = (id: string) => setExpanded(openId === id ? "" : id);
  const empty = runs.length === 0 && waitingFixes.length === 0;
  const showFixer = waitingFixes.length > 0 || fixing.length > 0;
  return (
    <Shell section="Rollouts">
      <header
        style={scoutStyle("experimenter")}
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
      >
        <ScoutMascot scout="experimenter" size={72} animated />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[28px] font-semibold leading-tight text-[#f5effb]">Rollouts</h1>
            <SimulatedBadge size="md" detail="PRs are simulated. No repository is connected." />
          </div>
          <p className="m-0 text-sm text-[color:var(--muted-foreground)]">
            Review the PR, check the deltas, merge.
            {prs.length > 0 && ` ${openCount} open.`}
          </p>
        </div>
        {!hasSample && !empty && <LoadSampleButton onLoad={seed} />}
      </header>

      {error && (
        <div className="error-note my-4" role="alert">
          {error}
        </div>
      )}

      {empty ? (
        <section
          aria-label="No pull requests yet"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#ffffff2e] px-5 py-10 text-center"
        >
          <ScoutMascot scout="experimenter" size={56} decorative />
          <h2 className="m-0 text-lg font-semibold">No pull requests yet</h2>
          <p className="m-0 text-sm text-[color:var(--muted-foreground)]">
            PRs land here when an A/B test finishes.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <LoadSampleButton onLoad={seed} variant="default" />
            <Button asChild variant="outline">
              <Link to="/insights">
                <Lightbulb />
                Insights
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <>
          {experimenting.length > 0 && (
            <Link
              to="/ab-tests"
              search={followRun ? { run: followRun.id } : {}}
              style={scoutStyle("experimenter")}
              className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--scout-ring)] bg-[color:var(--scout-tint)] p-3 text-sm no-underline"
            >
              <ScoutMascot scout="experimenter" size={28} decorative halo={false} />
              <span className="min-w-0 flex-1">
                {experimenting.length} {experimenting.length === 1 ? "test" : "tests"} still running
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--scout-main)]">
                Follow in A/B Tests
                <ArrowRight aria-hidden size={12} />
              </span>
            </Link>
          )}

          <section aria-labelledby="pull-requests">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 id="pull-requests" className="m-0 text-lg font-semibold">
                Pull requests
              </h2>
              <span className="rounded-full bg-[#ffffff10] px-2 py-0.5 text-xs tabular-nums text-[color:var(--muted-foreground)]">
                {prs.length}
              </span>
            </div>
            {prs.length === 0 ? (
              <p className="m-0 text-sm text-[color:var(--muted-foreground)]">
                PRs appear here when a run finishes.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {prs.map((run) => (
                  <PrCard
                    key={run.id}
                    run={run}
                    stage={sim.stageOf(run)}
                    expanded={openId === run.id}
                    onToggle={() => toggle(run.id)}
                    onMerge={guard(() => sim.mergePr(run.id))}
                    onClose={guard(() => sim.closePr(run.id))}
                  />
                ))}
              </div>
            )}
          </section>

          {showFixer && (
            <section aria-labelledby="bug-fixes" className="mt-10" style={scoutStyle("fixer")}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 id="bug-fixes" className="m-0 text-base font-semibold">
                  Bug fixes
                </h2>
                <span className="text-xs text-[color:var(--scout-main)]">Fixer</span>
                <SimulatedBadge />
              </div>
              {startError && (
                <div className="error-note mb-3" role="alert">
                  {startError}
                </div>
              )}
              {fixerOff && waitingFixes.length > 0 && (
                <p className="mb-3 text-xs text-[color:var(--muted-foreground)]" role="status">
                  Fixer is off in Settings → Scouts.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {waitingFixes.map(({ session, finding }) => (
                  <div
                    key={finding.id}
                    className="flex flex-col gap-2 rounded-lg border border-[#ffffff17] bg-[#ffffff05] p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{finding.title}</span>
                      <span className="truncate text-xs text-[color:var(--muted-foreground)]">
                        {effectiveTest(finding)?.change || finding.recommendation}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={fixerOff}
                      onClick={() => startFix({ session, finding })}
                    >
                      <Wrench />
                      Send to Fixer
                    </Button>
                  </div>
                ))}
                {fixing.map((run) => (
                  <FixRunCard key={run.id} run={run} stage={sim.stageOf(run)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
