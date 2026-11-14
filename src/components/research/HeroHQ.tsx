import { Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Coins, GitPullRequest, Radar, RotateCcw } from "lucide-react";
import { Footer, Shell } from "./Shell";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";
import { SourceMarker, VideoCount } from "./SourceMarker";
import { sourceAccent } from "@/lib/research/sourceMarkers";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { selectProduct, useProduct } from "@/hooks/use-product";
import { useSimulation } from "@/hooks/use-simulation";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { analysesToday, RUNNER_NOT_CONNECTED } from "@/lib/research/agentSettings";
import {
  competitorOf,
  competitorSessionsFor,
  isCompetitorSession,
} from "@/lib/research/competitors";
import { latestFindings } from "@/lib/research/insights";
import { isArchivedSession, products, sessionsForProduct } from "@/lib/research/products";
import { getScout, type ScoutId } from "@/lib/research/scouts";
import { sampleInsights } from "@/lib/research/demo/happyPath";
import { listSessions } from "@/lib/research/sessionStorage";
import type { SimulatedRun, StageState } from "@/lib/research/simulation";
import {
  buildUnifiedInsights,
  compareUnified,
  type UnifiedInsight,
} from "@/lib/research/unifiedInsights";
import type { Session } from "@/lib/research/types";

/*
 * HQ (docs/AUTOMATED-LOOP.md §1.1, §3; team decisions Nov 13). Left 2/3: insights that need you,
 * from the unified Tracker + Explorer view (no thumbnails). Right 1/3: agent activity tiles.
 * Tracker/Explorer numbers count stored real records; Experimenter/Fixer numbers and the
 * "Order again" sample come only from the separate simulated store and are always badged.
 */

type LiveState = "working" | "ready" | "idle" | "off";
type ProductRef = (typeof products)[number];
type Row = { item: UnifiedInsight; product: ProductRef };

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number) => nf.format(n);
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;
const ATTENTION_LIMIT = 6;
const TRACKER = getScout("tracker").colors.main;
const EXPLORER = getScout("explorer").colors.main;

function scoutStyle(id: ScoutId): CSSProperties {
  const { main, tint, ring } = getScout(id).colors;
  return { "--scout-main": main, "--scout-tint": tint, "--scout-ring": ring } as CSSProperties;
}

function relativeTime(at: number, now: number) {
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const tokensOf = (sessions: Session[]) =>
  sessions
    .flatMap((s) => s.runs)
    .reduce((sum, run) => {
      const total = run.usage?.total_tokens;
      return typeof total === "number" && Number.isFinite(total) ? sum + total : sum;
    }, 0);
const analyzedCount = (sessions: Session[]) =>
  sessions.filter((s) => s.runs.some((r) => r.status === "completed")).length;

/* ---------- Small parts ---------- */

const livePill: Record<LiveState, { label: string; className: string; dot: string }> = {
  working: {
    label: "Working",
    className: "border-[color:var(--scout-ring)] bg-[color:var(--scout-tint)] text-[#f5effb]",
    dot: "bg-[color:var(--scout-main)] motion-safe:animate-pulse",
  },
  ready: {
    label: "Ready",
    className: "border-[#ffffff26] bg-[#ffffff0a] text-[#e6e0f4]",
    dot: "bg-[color:var(--scout-main)]",
  },
  idle: {
    label: "Standing by",
    className: "border-[#ffffff1f] bg-[#ffffff08] text-[#c1b5d1]",
    dot: "bg-[#c1b5d1]",
  },
  off: {
    label: "Off",
    className: "border-[#ffffff1f] bg-transparent text-[#a99cbc]",
    dot: "bg-[#6f6585]",
  },
};
function LivePill({ state }: { state: LiveState }) {
  const pill = livePill[state];
  return (
    <span
      data-live={state}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${pill.className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
      {pill.label}
    </span>
  );
}

function StageBar({ stage }: { stage: StageState }) {
  const percent = Math.round(stage.progress * 100);
  return (
    <div
      role="progressbar"
      aria-label="Simulated run progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1 overflow-hidden rounded-full bg-[#ffffff14]"
    >
      <div
        className="h-full rounded-full bg-[color:var(--scout-main)] transition-[width] duration-700 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Compact stacked agent tile: mascot, live state, what it is doing, one count. */
function AgentTile({
  scout,
  state,
  doing,
  count,
  countLabel,
  simulated = false,
  muted = false,
  stage,
  to,
}: {
  scout: ScoutId;
  state: LiveState;
  doing: ReactNode;
  count: number;
  countLabel: string;
  simulated?: boolean;
  muted?: boolean;
  stage?: StageState | undefined;
  to?:
    | {
        to: "/insights" | "/ab-tests" | "/rollouts";
        label: string;
        search?: Record<string, string> | undefined;
        onClick?: (() => void) | undefined;
      }
    | undefined;
}) {
  const info = getScout(scout);
  return (
    <article
      aria-label={`${info.name} agent`}
      data-scout={scout}
      style={scoutStyle(scout)}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border p-3 ${
        muted
          ? "border-[#ffffff12] bg-[#ffffff03] opacity-80"
          : "border-[color:var(--scout-ring)] bg-[color:var(--scout-tint)]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ScoutMascot
          scout={scout}
          size={muted ? 30 : 40}
          animated={!muted}
          decorative
          halo={false}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="m-0 text-sm font-semibold leading-tight text-[color:var(--scout-main)]">
              {info.name}
            </h3>
            <LivePill state={state} />
            {simulated && <SimulatedBadge />}
          </div>
          <p className="m-0 truncate text-xs text-[color:var(--foreground)]" aria-live="polite">
            {doing}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-xl font-semibold leading-none tabular-nums text-[#f5effb]">
            {count}
          </span>
          <span className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
            {countLabel}
          </span>
        </div>
      </div>
      {stage && !stage.done && <StageBar stage={stage} />}
      {to && (
        <Link
          to={to.to}
          search={(to.search ?? {}) as never}
          onClick={to.onClick}
          className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-[color:var(--scout-main)] no-underline hover:underline"
        >
          {to.label}
          <ArrowRight aria-hidden size={11} />
        </Link>
      )}
    </article>
  );
}

function Meter({
  label,
  used,
  cap,
  color,
}: {
  label: string;
  used: number;
  cap: number;
  color: string;
}) {
  const width = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 100;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[color:var(--muted-foreground)]">{label}</span>
        <span className="font-semibold tabular-nums text-[#f5effb]">
          {fmt(used)} / {fmt(cap)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#ffffff12]" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

type SpendRow = { label: string; value: number; color: string };
function SpendBars({ label, rows }: { label: string; rows: SpendRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {label}
      </span>
      <dl className="m-0 flex flex-col gap-1.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-2"
          >
            <dt className="truncate text-xs text-[color:var(--muted-foreground)]">{row.label}</dt>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#ffffff0d]" aria-hidden="true">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.value ? Math.max(3, (row.value / max) * 100) : 0}%`,
                  background: row.color,
                }}
              />
            </div>
            <dd className="m-0 text-right text-xs font-semibold tabular-nums text-[#f5effb]">
              {fmt(row.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------- Needs your attention ---------- */

function statusOf(item: UnifiedInsight, running: boolean) {
  if (item.review_status === "rejected" || item.decision === "rejected") return "Rejected";
  if (item.decision === "approved") return running ? "Test running" : "Test approved";
  if (item.review_status === "pending") return "Review insight";
  if (item.suggested_test || item.route === "fix")
    return item.route === "fix" ? "Approve fix" : "Approve test";
  return "Accepted";
}

function InsightRow({ row, running }: { row: Row; running: boolean }) {
  const { item, product } = row;
  const status = statusOf(item, running);
  const urgent = item.needs_attention;
  return (
    <li>
      <Link
        to={item.link.to}
        params={item.link.params}
        onClick={() => selectProduct(product.id)}
        data-source={item.source}
        data-kind={item.kind}
        className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-[#ffffff17] bg-[#ffffff06] p-4 pl-5 no-underline transition-colors hover:border-[#ffffff33] hover:bg-[#ffffff0d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: sourceAccent(item.source) }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <SourceMarker source={item.source} competitor={item.competitor} />
            {item.kind === "sample" && <SimulatedBadge detail="Fictional sample for the demo" />}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                urgent ? "bg-[#f7cf7c24] text-[#f7cf7c]" : "bg-[#ffffff0d] text-[#c1b5d1]"
              }`}
            >
              {status}
            </span>
          </span>
          <span className="text-[15px] font-semibold leading-snug text-[#f5effb]">
            {item.title}
          </span>
          <span className="line-clamp-2 text-xs leading-snug text-[color:var(--muted-foreground)]">
            {item.summary}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
            <VideoCount
              count={item.video_count}
              illustrative={item.kind === "sample"}
              source={item.source}
            />
            <span className="self-center">{product.name}</span>
          </span>
        </span>
        <ArrowRight
          aria-hidden
          size={15}
          className="mt-1 shrink-0 text-[color:var(--muted-foreground)] group-hover:text-[#f5effb]"
        />
      </Link>
    </li>
  );
}

/* ---------- Page ---------- */

export function HeroHQ() {
  const [all, setAll] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const { settings } = useAgentSettings();
  const sim = useSimulation();
  const { productId } = useProduct();
  // Insights is product-scoped: from HQ, land on the demo product when none is chosen yet.
  const demoProduct = sampleInsights()[0]?.product_id ?? products[0]!.id;
  const ensureProduct = () => {
    if (!productId) selectProduct(demoProduct);
  };
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

  /* Real records. */
  const own = all.filter((s) => !isCompetitorSession(s) && !isArchivedSession(s));
  const competitor = all.filter((s) => isCompetitorSession(s));
  const ownInsights = own.reduce((n, s) => n + latestFindings(s).length, 0);
  const competitorInsights = competitor.reduce((n, s) => n + latestFindings(s).length, 0);
  const trackerTokens = tokensOf(own);
  const explorerTokens = tokensOf(competitor);
  const now = new Date(sim.now);
  const trackerToday = analysesToday(all, now, "tracker");
  const explorerToday = analysesToday(all, now, "explorer");
  const latestOwnRun = own
    .flatMap((session) =>
      session.runs.map((run) => ({ session, at: Date.parse(run.completed_at) })),
    )
    .filter(({ at }) => Number.isFinite(at))
    .sort((a, b) => b.at - a.at)[0];

  /* Unified insights (Tracker + Explorer + labeled sample), across products. */
  const rows: Row[] = products.flatMap((product) =>
    buildUnifiedInsights(all, product.id, { sampleDecision: sim.sampleDecision }).map((item) => ({
      item,
      product,
    })),
  );
  // Featured demo rows stay while they need you or their test is in progress; rejected ones drop out.
  const featured = rows
    .filter(
      (r) =>
        r.item.featured_rank !== null && (r.item.needs_attention || r.item.decision === "approved"),
    )
    .sort((a, b) => a.item.featured_rank! - b.item.featured_rank!);
  const others = rows
    .filter((r) => r.item.featured_rank === null && r.item.needs_attention)
    .sort((a, b) => compareUnified(a.item, b.item));
  const shown = [...featured, ...others].slice(0, ATTENTION_LIMIT);
  // Real items only; the fictional sample and simulated PRs are counted separately and labeled.
  const attentionTotal = rows.filter(
    (r) => r.item.needs_attention && r.item.kind === "real",
  ).length;
  const sampleAttention = rows.filter(
    (r) => r.item.needs_attention && r.item.kind === "sample",
  ).length;

  /* Simulated records (separate store, always badged). */
  const states = sim.runs.map((run) => ({ run, stage: sim.stageOf(run) }));
  const activeOf = (kind: SimulatedRun["kind"]) =>
    states
      .filter(({ run, stage }) => run.kind === kind && !stage.done)
      .sort((a, b) => Date.parse(b.run.started_at) - Date.parse(a.run.started_at));
  const activeExperiments = activeOf("experiment");
  const activeFixes = activeOf("fix");
  const prsReady = states
    .filter(({ run, stage }) => stage.prReady && run.pr.status === "open")
    .map(({ run }) => run);
  const happy = sim.happyPathRun;
  const happyRunning = !!happy && !sim.stageOf(happy).done;
  const currentExperiment =
    activeExperiments.find(({ run }) => run.happy_path) ?? activeExperiments[0];
  const currentFix = activeFixes[0];

  /* Agents with a live (simulated) run. Tracker/Explorer only run on a manual Analyze. */
  const working = (activeExperiments.length ? 1 : 0) + (activeFixes.length ? 1 : 0);
  const needsYou = attentionTotal;
  const simulatedNeedsYou = sampleAttention + prsReady.length;
  const demoTouched = sim.sampleDecision.decision !== "pending" || !!happy;

  const explorerIdle = !competitor.length;
  const competitorName = competitorOf("uber-eats")?.name ?? "competitors";
  const experimentState: LiveState = !settings.experimenter.enabled
    ? "off"
    : activeExperiments.length
      ? "working"
      : "idle";
  const fixState: LiveState = !settings.fixer.enabled
    ? "off"
    : activeFixes.length
      ? "working"
      : "idle";

  const spendByProduct: SpendRow[] = products.map((product) => ({
    label: product.name,
    value:
      tokensOf(sessionsForProduct(own, product.id)) +
      tokensOf(competitorSessionsFor(all, product.id)),
    color: "#c4bbff",
  }));

  return (
    <Shell section="HQ">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Radar aria-hidden size={22} style={{ color: "#f7cf7c" }} />
          <div className="min-w-0">
            <h1 className="m-0 text-[26px] font-semibold leading-tight text-[#f5effb]">HQ</h1>
            <p className="m-0 text-sm text-[color:var(--muted-foreground)]">
              Your agents at a glance. Start with what needs you.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffffff1f] bg-[#ffffff0a] px-3 py-1 text-[#e6e0f4]">
            <span>
              <strong className="tabular-nums">{working}</strong> of 4 agents working
            </span>
            {working > 0 && <SimulatedBadge detail="Experimenter and Fixer runs are simulated." />}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f7cf7c4d] bg-[#f7cf7c14] px-3 py-1 text-[#f7cf7c]">
            <span>
              <strong className="tabular-nums">{needsYou}</strong> need you
            </span>
            {simulatedNeedsYou > 0 && (
              <SimulatedBadge
                label={`+${simulatedNeedsYou} sample`}
                detail="The fictional sample insight and simulated PRs, not counted as real."
              />
            )}
          </span>
          <span
            title={`${RUNNER_NOT_CONNECTED}. Tracker and Explorer analyze when you press Analyze, within the daily cap.`}
            className="rounded-full border border-dashed border-[#ffffff2e] px-3 py-1 text-[#c1b5d1]"
          >
            Manual runs · runner not connected
          </span>
          {demoTouched && (
            <button
              type="button"
              onClick={() => sim.resetSample()}
              title="Put the sample insight back to pending (simulated demo only)"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#efc68f59] px-3 py-1 text-[#f3d3a4] hover:bg-[#efc68f14]"
            >
              <RotateCcw aria-hidden size={12} />
              Restart demo
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="error-note mb-5" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2/3: what needs you */}
        <section aria-labelledby="hq-attention" className="min-w-0 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="hq-attention" className="m-0 text-lg font-semibold text-[#f5effb]">
              Needs your attention
            </h2>
            <Link
              to="/insights"
              onClick={ensureProduct}
              className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] no-underline hover:underline"
            >
              All insights
              <ArrowRight aria-hidden size={12} />
            </Link>
          </div>
          {shown.length ? (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Insights">
              {shown.map((row) => (
                <InsightRow
                  key={row.item.key}
                  row={row}
                  running={row.item.kind === "sample" && happyRunning}
                />
              ))}
            </ul>
          ) : (
            <p className="m-0 rounded-xl border border-[#ffffff17] bg-[#ffffff05] p-4 text-xs text-[color:var(--muted-foreground)]">
              {loaded ? "Nothing needs you right now." : "Checking insights…"}
            </p>
          )}

          <div className="mt-6">
            <h3 className="m-0 mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#f5effb]">
              <GitPullRequest
                aria-hidden
                size={14}
                style={{ color: getScout("experimenter").colors.main }}
              />
              PRs ready to review
              <span className="rounded-full bg-[#ffffff10] px-2 py-0.5 text-xs tabular-nums">
                {prsReady.length}
              </span>
              <SimulatedBadge />
            </h3>
            {prsReady.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="PRs ready">
                {prsReady.slice(0, 4).map((run) => (
                  <li key={run.id}>
                    <Link
                      to="/rollouts"
                      search={{ pr: run.id }}
                      onClick={() => {
                        if (run.product_id) selectProduct(run.product_id);
                      }}
                      style={scoutStyle(run.scout)}
                      className="group flex items-center gap-3 rounded-lg border border-dashed border-[#efc68f3d] bg-[#efc68f06] p-3 no-underline transition-colors hover:border-[color:var(--scout-ring)]"
                    >
                      <ScoutMascot scout={run.scout} size={26} decorative halo={false} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#f5effb]">
                        {run.pr.title}
                      </span>
                      <ArrowRight
                        aria-hidden
                        size={14}
                        className="shrink-0 text-[color:var(--muted-foreground)] group-hover:text-[color:var(--scout-main)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-xs text-[color:var(--muted-foreground)]">
                None yet. Approve a test to start one.
              </p>
            )}
          </div>
        </section>

        {/* Right 1/3: agent activity */}
        <aside aria-labelledby="hq-agents" className="flex min-w-0 flex-col gap-3">
          <h2 id="hq-agents" className="m-0 text-lg font-semibold text-[#f5effb]">
            Agent activity
          </h2>
          <AgentTile
            scout="tracker"
            state={settings.tracker.enabled ? "ready" : "off"}
            count={ownInsights}
            countLabel="insights"
            doing={
              !loaded
                ? "Checking recordings…"
                : latestOwnRun
                  ? `Last run ${relativeTime(latestOwnRun.at, sim.now)} · ${analyzedCount(own)} watched`
                  : own.length
                    ? `${own.length} ${own.length === 1 ? "recording" : "recordings"} waiting`
                    : "No recordings yet"
            }
            to={{ to: "/insights", label: "Insights", onClick: ensureProduct }}
          />
          <AgentTile
            scout="explorer"
            state={!settings.explorer.enabled ? "off" : explorerIdle ? "idle" : "ready"}
            count={competitorInsights}
            countLabel="insights"
            doing={
              explorerIdle
                ? `No ${competitorName} footage yet`
                : `Watching ${competitorName} · ${plural(analyzedCount(competitor), "clip")} analyzed`
            }
            to={{
              to: "/insights",
              label: "Insights",
              search: { source: "explorer" },
              onClick: ensureProduct,
            }}
          />
          <AgentTile
            scout="experimenter"
            state={experimentState}
            count={activeExperiments.length}
            countLabel="running"
            simulated
            stage={currentExperiment?.stage}
            doing={
              currentExperiment
                ? `${currentExperiment.run.finding_title}: ${currentExperiment.stage.label}`
                : experimentState === "off"
                  ? "Off in Settings"
                  : "Waiting for an approved test"
            }
            to={{
              to: "/ab-tests",
              label: "A/B Tests",
              search: currentExperiment ? { run: currentExperiment.run.id } : undefined,
            }}
          />
          <AgentTile
            scout="fixer"
            state={fixState}
            count={activeFixes.length}
            countLabel="building"
            simulated
            muted
            stage={currentFix?.stage}
            doing={currentFix ? currentFix.run.finding_title : "Bugs only · standing by"}
          />

          <section
            aria-labelledby="hq-usage"
            className="flex flex-col gap-3 rounded-xl border border-[#ffffff17] bg-[#ffffff05] p-3"
          >
            <h3
              id="hq-usage"
              className="m-0 flex items-center gap-1.5 text-sm font-semibold text-[#f5effb]"
            >
              <Coins aria-hidden size={14} style={{ color: "#f7cf7c" }} />
              Usage
            </h3>
            <Meter
              label="Tracker analyses today"
              used={trackerToday}
              cap={settings.tracker.max_analyses_per_day}
              color={TRACKER}
            />
            <Meter
              label="Explorer analyses today"
              used={explorerToday}
              cap={settings.explorer.max_analyses_per_day}
              color={EXPLORER}
            />
            <SpendBars
              label="Tokens by agent"
              rows={[
                { label: "Tracker", value: trackerTokens, color: TRACKER },
                { label: "Explorer", value: explorerTokens, color: EXPLORER },
              ]}
            />
            <SpendBars label="Tokens by product" rows={spendByProduct} />
            <p
              className="m-0 text-[11px] text-[color:var(--muted-foreground)]"
              title="Token totals are provider-reported on stored runs. Billing credits are not connected in the prototype; Experimenter and Fixer runs are simulated and use no tokens."
            >
              Provider-reported tokens · credits not connected
            </p>
          </section>
        </aside>
      </div>

      <Footer />
    </Shell>
  );
}
