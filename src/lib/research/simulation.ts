import { isCompetitorSession } from "./competitors";
import {
  HAPPY_PATH_TRAFFIC_PERCENT,
  ORDER_AGAIN_FINDING_ID,
  SAMPLE_SESSION_ID,
  getSampleInsight,
  orderAgainTest,
} from "./demo/happyPath";
import type { ProductId } from "./products";
import { effectiveTest } from "./testDecisions";
import type { Finding, Session, SuggestedRoute, SuggestedTest } from "./types";

/**
 * SIMULATED DEMO DATA (AUTOMATED-LOOP.md §3). Fixer/Experimenter runs, variant recordings,
 * deltas and PRs are not connected in the prototype. Every record carries `simulated: true`
 * and must be shown with a visible "Simulated demo" badge. Records live in their own
 * localStorage key, never in IndexedDB research sessions, and never enter Insights priorities,
 * Evaluation metrics or real counters. Nothing here makes a network call, touches a repository
 * or deploys anything.
 */
export const SIMULATION_KEY = "loopmate-simulated-demo";
export const SIMULATED_BADGE = "Simulated demo";
export const ILLUSTRATIVE_NOTE = "Illustrative, not measured";
export const EXPERIMENT_TRAFFIC_PERCENT = 20;

export type SimulatedKind = "experiment" | "fix";
export type SimulatedScout = "experimenter" | "fixer";
export type SimulatedPrStatus = "open" | "merged" | "closed";

export interface SimulatedDelta {
  metric: string;
  /** Control (experiment) or before-fix value; illustrative text such as "38 s". */
  control: string;
  /** Variant (experiment) or after-fix value. */
  variant: string;
  /** Relative change text, e.g. "−18%" or "+6 pts". */
  change: string;
  direction: "better" | "worse" | "neutral";
  illustrative: true;
  /** Optional analytics role (primary metric, guardrail or secondary). */
  role?: "primary" | "guardrail" | "secondary" | undefined;
}
/** One line of a unified diff hunk (illustrative; no repository is connected). */
export interface SimulatedDiffLine {
  type: "context" | "add" | "del";
  text: string;
  /** Line number in the old file (context/del). */
  old?: number | undefined;
  /** Line number in the new file (context/add). */
  new?: number | undefined;
}
export interface SimulatedDiffHunk {
  /** e.g. "@@ -1,8 +1,11 @@ export function HomeScreen() {" */
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: SimulatedDiffLine[];
}
export interface SimulatedFileDiff {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  hunks: SimulatedDiffHunk[];
  illustrative: true;
}
export interface SimulatedCheck {
  name: string;
  status: "passed";
  illustrative: true;
}
/** Control vs variant analytics for the PR review. Always illustrative, never measured. */
export interface SimulatedAnalytics {
  illustrative: true;
  note: string;
  unit: "users" | "sessions";
  sample_sizes: { control: number; variant: number };
  traffic_percent?: number | undefined;
  /** e.g. "14 days (simulated)". */
  window_label: string;
  metrics: SimulatedDelta[];
}
export interface SimulatedPr {
  title: string;
  summary: string;
  /** Files the change would touch (illustrative paths; no repository is connected). */
  files: string[];
  branch: string;
  status: SimulatedPrStatus;
  updated_at?: string | undefined;
  /** Set when the simulated PR is marked merged. */
  merged_at?: string | undefined;
  /** Illustrative unified diffs (absent on runs stored before Nov 13; see prReview()). */
  diffs?: SimulatedFileDiff[] | undefined;
  analytics?: SimulatedAnalytics | undefined;
  checks?: SimulatedCheck[] | undefined;
}
export interface SimulatedRun {
  id: string;
  simulated: true;
  kind: SimulatedKind;
  scout: SimulatedScout;
  /** Null for seeded sample runs, which are not linked to a real finding. */
  session_id: string | null;
  finding_id: string | null;
  product_id: ProductId | null;
  finding_title: string;
  /** Snapshot of the approved test (experiment) or fix (change = the fix) at approval time. */
  test: SuggestedTest;
  /** Experiment only: share of simulated traffic that sees the variant. */
  traffic_percent?: number | undefined;
  started_at: string;
  duration_ms: number;
  /** Illustrative counts of simulated recordings (variant/control, or verification for fixes). */
  recordings: { control: number; variant: number; illustrative: true };
  deltas: SimulatedDelta[];
  pr: SimulatedPr;
  /** True for runs created by seedSampleLoop. */
  sample?: boolean | undefined;
  /** Where the idea came from, e.g. { scout: "explorer", label: "DoorDash footage (sample)" }. */
  idea_source?: { scout: "tracker" | "explorer"; label: string } | undefined;
  /** True for the demo happy-path run started by approving the sample "Order again" test. */
  happy_path?: boolean | undefined;
  /** Unified-insight source marker of the originating insight. */
  insight_source?: "tracker" | "explorer" | "both" | undefined;
}

export interface SimulatedStage {
  label: string;
  /** Offset from start at which this stage begins. */
  at_ms: number;
}
export const EXPERIMENT_DURATION_MS = 40000;
export const FIX_DURATION_MS = 20000;
export const EXPERIMENT_STAGES: readonly SimulatedStage[] = [
  { label: "Designing test", at_ms: 0 },
  { label: "Building variant", at_ms: 4000 },
  { label: `Collecting variant recordings (${EXPERIMENT_TRAFFIC_PERCENT}% traffic)`, at_ms: 10000 },
  { label: "Analyzing", at_ms: 20000 },
  { label: "Comparing deltas", at_ms: 28000 },
  { label: "Drafting PR", at_ms: 34000 },
  { label: "PR ready", at_ms: EXPERIMENT_DURATION_MS },
];
export const FIX_STAGES: readonly SimulatedStage[] = [
  { label: "Building fix", at_ms: 0 },
  { label: "Verifying on recordings", at_ms: 7000 },
  { label: "Drafting PR", at_ms: 14000 },
  { label: "PR ready", at_ms: FIX_DURATION_MS },
];
export const stagesFor = (kind: SimulatedKind) =>
  kind === "experiment" ? EXPERIMENT_STAGES : FIX_STAGES;
/** Column labels for deltas. */
export const deltaLabels = (kind: SimulatedKind) =>
  kind === "experiment"
    ? { control: "Control", variant: "Variant" }
    : { control: "Before fix", variant: "After fix" };

export interface StageState {
  /** Index into stagesFor(run.kind). */
  index: number;
  label: string;
  stages: readonly SimulatedStage[];
  /** 0..1 over the whole run. */
  progress: number;
  done: boolean;
  /** Deltas are revealed from "Comparing deltas" (experiment) / "Verifying on recordings" (fix). */
  deltasVisible: boolean;
  prReady: boolean;
}
export function runStage(
  run: Pick<SimulatedRun, "kind" | "started_at" | "duration_ms">,
  now = Date.now(),
): StageState {
  const stages = stagesFor(run.kind);
  const started = Date.parse(run.started_at);
  const elapsed = Number.isFinite(started) ? Math.max(0, now - started) : run.duration_ms;
  let index = 0;
  stages.forEach((stage, i) => {
    if (elapsed >= stage.at_ms) index = i;
  });
  const done = elapsed >= run.duration_ms;
  if (done) index = stages.length - 1;
  const revealAt = run.kind === "experiment" ? 4 : 1;
  return {
    index,
    label: stages[index]!.label,
    stages,
    progress: Math.min(1, elapsed / run.duration_ms),
    done,
    deltasVisible: index >= revealAt,
    prReady: done,
  };
}

/** FNV-1a; deterministic across sessions so the same test always shows the same sample. */
export function contentHash(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
const pick = (hash: number, salt: number, min: number, max: number) =>
  min + ((((hash >>> (salt % 24)) ^ (hash * (salt + 7))) >>> 0) % (max - min + 1));
const pct = (from: number, to: number) => Math.round(((to - from) / from) * 100);
const signed = (n: number, unit: string) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}${unit}`;

/** Illustrative sample deltas derived from the test text. Never measured, never statistics. */
export function illustrativeDeltas(kind: SimulatedKind, test: SuggestedTest): SimulatedDelta[] {
  const hash = contentHash(`${kind}|${test.hypothesis}|${test.change}|${test.primary_metric}`);
  const timeControl = pick(hash, 1, 24, 58);
  const timeVariant = Math.round(timeControl * (1 - pick(hash, 2, 8, 26) / 100));
  const missControl = pick(hash, 3, 12, 30) / 10;
  const missVariant = Math.round(missControl * (1 - pick(hash, 4, 20, 55) / 100) * 10) / 10;
  const doneControl = pick(hash, 5, 61, 84);
  const doneVariant = Math.min(97, doneControl + pick(hash, 6, 2, 9));
  return [
    {
      metric: "Median time on step",
      control: `${timeControl} s`,
      variant: `${timeVariant} s`,
      change: signed(pct(timeControl, timeVariant), "%"),
      direction: "better",
      illustrative: true,
    },
    {
      metric: "Missed or repeated taps per session",
      control: missControl.toFixed(1),
      variant: missVariant.toFixed(1),
      change: signed(pct(missControl, missVariant), "%"),
      direction: "better",
      illustrative: true,
    },
    {
      metric: "Task completion",
      control: `${doneControl}%`,
      variant: `${doneVariant}%`,
      change: signed(doneVariant - doneControl, " pts"),
      direction: "better",
      illustrative: true,
    },
  ];
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "flow";
const shorten = (value: string, max = 72) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

// ---- Illustrative unified diffs (no repository is read or written) ----

/**
 * Builds a hunk from prefixed lines (" " context, "+" added, "-" removed), computing line
 * numbers and the @@ header so the diff is internally consistent.
 */
export function diffHunk(
  oldStart: number,
  newStart: number,
  lines: readonly string[],
  section = "",
): SimulatedDiffHunk {
  let oldLine = oldStart;
  let newLine = newStart;
  const parsed: SimulatedDiffLine[] = lines.map((raw) => {
    const mark = raw[0];
    const text = raw.slice(1);
    if (mark === "+") return { type: "add", text, new: newLine++ };
    if (mark === "-") return { type: "del", text, old: oldLine++ };
    return { type: "context", text, old: oldLine++, new: newLine++ };
  });
  const oldLines = parsed.filter((l) => l.type !== "add").length;
  const newLines = parsed.filter((l) => l.type !== "del").length;
  const range = (start: number, count: number) =>
    `${count === 0 ? Math.max(0, start - 1) : start},${count}`;
  return {
    header: `@@ -${range(oldStart, oldLines)} +${range(newStart, newLines)} @@${section ? ` ${section}` : ""}`,
    old_start: oldLines === 0 ? 0 : oldStart,
    old_lines: oldLines,
    new_start: newStart,
    new_lines: newLines,
    lines: parsed,
  };
}
/** A file diff from hunks; additions/deletions are counted from the hunks. */
export function fileDiff(
  path: string,
  status: SimulatedFileDiff["status"],
  hunks: SimulatedDiffHunk[],
): SimulatedFileDiff {
  const all = hunks.flatMap((h) => h.lines);
  return {
    path,
    status,
    additions: all.filter((l) => l.type === "add").length,
    deletions: all.filter((l) => l.type === "del").length,
    hunks,
    illustrative: true,
  };
}
/** A new file as a single all-added hunk. */
export const addedFile = (path: string, content: readonly string[]) =>
  fileDiff(path, "added", [
    diffHunk(
      0,
      1,
      content.map((line) => `+${line}`),
    ),
  ]);
/** Plain-text unified patch (git-style) for copy/export or a raw view. */
export function formatUnifiedPatch(diff: SimulatedFileDiff) {
  const head =
    diff.status === "added"
      ? ["--- /dev/null", `+++ b/${diff.path}`]
      : diff.status === "deleted"
        ? [`--- a/${diff.path}`, "+++ /dev/null"]
        : [`--- a/${diff.path}`, `+++ b/${diff.path}`];
  const body = diff.hunks.flatMap((h) => [
    h.header,
    ...h.lines.map((l) => `${l.type === "add" ? "+" : l.type === "del" ? "-" : " "}${l.text}`),
  ]);
  return [`diff --git a/${diff.path} b/${diff.path}`, ...head, ...body].join("\n");
}
/** Totals for a PR header ("4 files · +62 −2"). */
export function diffStats(diffs: readonly SimulatedFileDiff[]) {
  return {
    files: diffs.length,
    additions: diffs.reduce((n, d) => n + d.additions, 0),
    deletions: diffs.reduce((n, d) => n + d.deletions, 0),
  };
}
const SIMULATED_CHECKS: SimulatedCheck[] = [
  { name: "Unit tests", status: "passed", illustrative: true },
  { name: "Type check", status: "passed", illustrative: true },
  { name: "Lint", status: "passed", illustrative: true },
];
const pascal = (name: string) => {
  const value = name
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
  return /^[A-Z]/.test(value) ? value : `Screen${value}`;
};
/** Safe inside a JS double-quoted string or a block comment in the illustrative code. */
const codeText = (value: string, max = 60) =>
  shorten(value.replace(/[\r\n]+/g, " "), max)
    .replaceAll("\\", "")
    .replaceAll('"', "'")
    .replaceAll("*/", "* /");

/** Simple generated diffs for any finding's simulated run. Deterministic from the inputs. */
export function generatedDiffs(
  kind: SimulatedKind,
  test: SuggestedTest,
  screen: string,
): SimulatedFileDiff[] {
  const name = slug(screen);
  const Name = pascal(name);
  const camel = Name[0]!.toLowerCase() + Name.slice(1);
  const title = codeText(screen, 40);
  const change = codeText(test.change || "Improve this screen");
  const flag = `${name.replaceAll("-", "_")}_variant`;
  if (kind === "experiment")
    return [
      fileDiff(`src/screens/${name}.tsx`, "modified", [
        diffHunk(1, 1, [
          ' import { ScreenLayout } from "../ui/ScreenLayout";',
          '+import { useVariant } from "../experiments/useVariant";',
          `+import { ${camel}Variant } from "../experiments/${name}-variant";`,
          ` import { ${Name}Content } from "./${name}-content";`,
          " ",
          ` export function ${Name}Screen() {`,
          `+  const variant = useVariant(${camel}Variant);`,
          "   return (",
          `-    <ScreenLayout title="${title}">`,
          `-      <${Name}Content />`,
          `+    <ScreenLayout title="${title}" variant={variant}>`,
          `+      <${Name}Content variant={variant} />`,
          "     </ScreenLayout>",
          "   );",
          " }",
        ]),
      ]),
      addedFile(`src/experiments/${name}-variant.ts`, [
        `/* LoopMate experiment: ${change} */`,
        `export const ${camel}Variant = {`,
        `  flag: "${flag}",`,
        `  traffic: ${EXPERIMENT_TRAFFIC_PERCENT / 100},`,
        `  primaryMetric: "${codeText(test.primary_metric || "task completion", 50)}",`,
        ...(test.guardrail_metric
          ? [`  guardrailMetric: "${codeText(test.guardrail_metric, 50)}",`]
          : []),
        "} as const;",
      ]),
      addedFile(`src/screens/__tests__/${name}.test.tsx`, [
        'import { render, screen } from "@testing-library/react";',
        `import { ${Name}Screen } from "../${name}";`,
        "",
        `it("renders ${title} with the variant flag on", () => {`,
        `  render(<${Name}Screen />);`,
        `  expect(screen.getByRole("main")).toBeInTheDocument();`,
        "});",
      ]),
    ];
  return [
    fileDiff(`src/screens/${name}.tsx`, "modified", [
      diffHunk(
        6,
        6,
        [
          "   return (",
          `     <ScreenLayout title="${title}">`,
          `-      <${Name}Content />`,
          `+      {/* Fix: ${change} */}`,
          `+      <${Name}Content comfortableTargets />`,
          "     </ScreenLayout>",
          "   );",
        ],
        `export function ${Name}Screen() {`,
      ),
    ]),
    addedFile(`src/screens/__tests__/${name}.test.tsx`, [
      'import { render, screen } from "@testing-library/react";',
      `import { ${Name}Screen } from "../${name}";`,
      "",
      `it("keeps ${title} usable after the fix", () => {`,
      `  render(<${Name}Screen />);`,
      `  expect(screen.getByRole("main")).toBeInTheDocument();`,
      "});",
    ]),
  ];
}
/** Analytics block derived from a run's deltas and simulated recording counts. */
export function generatedAnalytics(
  kind: SimulatedKind,
  deltas: SimulatedDelta[],
  recordings: SimulatedRun["recordings"],
): SimulatedAnalytics {
  return {
    illustrative: true,
    note: ILLUSTRATIVE_NOTE,
    unit: "sessions",
    sample_sizes: { control: recordings.control, variant: recordings.variant },
    ...(kind === "experiment" ? { traffic_percent: EXPERIMENT_TRAFFIC_PERCENT } : {}),
    window_label: kind === "experiment" ? "7 days (simulated)" : "Verification run (simulated)",
    metrics: deltas.map((delta, i) => ({
      ...delta,
      role: delta.role ?? (i === 0 ? "primary" : "secondary"),
    })),
  };
}
/**
 * Review content for a run's PR: stored diffs/analytics/checks, or deterministic generated ones
 * for runs stored before these fields existed.
 */
export function prReview(run: SimulatedRun) {
  const screen = run.test.target_screen?.trim() || run.finding_title;
  return {
    diffs: run.pr.diffs ?? generatedDiffs(run.kind, run.test, screen),
    analytics: run.pr.analytics ?? generatedAnalytics(run.kind, run.deltas, run.recordings),
    checks: run.pr.checks ?? SIMULATED_CHECKS.map((c) => ({ ...c })),
  };
}

// ---- Happy path: "Order again on the home screen" (fictional sample, AUTOMATED-LOOP §3) ----

/** Illustrative control vs variant analytics for the Order again experiment. Not measured. */
export function orderAgainAnalytics(): SimulatedAnalytics {
  const metrics: SimulatedDelta[] = [
    {
      metric: "Reorders per user",
      control: "0.42",
      variant: "0.61",
      change: "+45%",
      direction: "better",
      illustrative: true,
      role: "primary",
    },
    {
      metric: "Median time to reorder",
      control: "74 s",
      variant: "21 s",
      change: "−72%",
      direction: "better",
      illustrative: true,
      role: "secondary",
    },
    {
      metric: "Checkout errors",
      control: "1.9%",
      variant: "1.8%",
      change: "−0.1 pts",
      direction: "neutral",
      illustrative: true,
      role: "guardrail",
    },
  ];
  return {
    illustrative: true,
    note: ILLUSTRATIVE_NOTE,
    unit: "users",
    sample_sizes: { control: 4120, variant: 1030 },
    traffic_percent: HAPPY_PATH_TRAFFIC_PERCENT,
    window_label: "14 days (simulated)",
    metrics,
  };
}
/** Illustrative diffs for the Order again PR (fictional codebase; nothing is read or written). */
export function orderAgainDiffs(): SimulatedFileDiff[] {
  return [
    fileDiff("src/features/home/HomeScreen.tsx", "modified", [
      diffHunk(1, 1, [
        ' import { HomeHeader } from "./HomeHeader";',
        ' import { CategoryCarousel } from "./CategoryCarousel";',
        '+import { OrderAgainRail } from "./OrderAgainRail";',
        ' import { RestaurantFeed } from "./RestaurantFeed";',
        '-import { useHomeFeed } from "./useHomeFeed";',
        '+import { useHomeFeed, useRecentOrders } from "./useHomeFeed";',
        '+import { useFlag } from "@/experiments/flags";',
        " ",
        " export function HomeScreen() {",
        "   const feed = useHomeFeed();",
        "+  const recentOrders = useRecentOrders({ limit: 5 });",
        '+  const orderAgain = useFlag("order_again_home");',
        " ",
      ]),
      diffHunk(
        9,
        13,
        [
          "   return (",
          '     <main className="home">',
          "       <HomeHeader address={feed.address} />",
          "+      {orderAgain && recentOrders.length > 0 && (",
          "+        <OrderAgainRail orders={recentOrders} />",
          "+      )}",
          "       <CategoryCarousel categories={feed.categories} />",
          "       <RestaurantFeed restaurants={feed.restaurants} />",
          "     </main>",
        ],
        "export function HomeScreen() {",
      ),
    ]),
    addedFile("src/features/home/OrderAgainRail.tsx", [
      'import { track } from "@/analytics/track";',
      'import { reorder } from "@/orders/reorder";',
      'import type { PastOrder } from "@/orders/types";',
      "",
      "interface OrderAgainRailProps {",
      "  orders: PastOrder[];",
      "}",
      "",
      "/** Experiment order_again_home: one-tap reorder of recent orders on the home screen. */",
      "export function OrderAgainRail({ orders }: OrderAgainRailProps) {",
      "  return (",
      '    <section aria-labelledby="order-again-title" className="order-again">',
      '      <h2 id="order-again-title">Order again</h2>',
      '      <ul className="order-again__list">',
      "        {orders.map((order) => (",
      '          <li key={order.id} className="order-again__card">',
      '            <img src={order.restaurant.imageUrl} alt="" />',
      "            <div>",
      '              <p className="order-again__name">{order.restaurant.name}</p>',
      '              <p className="order-again__items">{order.summary}</p>',
      "            </div>",
      "            <button",
      '              type="button"',
      "              onClick={() => {",
      '                track("order_again_tap", { orderId: order.id });',
      "                void reorder(order.id);",
      "              }}",
      "            >",
      "              Reorder",
      "            </button>",
      "          </li>",
      "        ))}",
      "      </ul>",
      "    </section>",
      "  );",
      "}",
    ]),
    fileDiff("src/experiments/flags.ts", "modified", [
      diffHunk(
        8,
        8,
        [
          '   new_checkout_summary: { rollout: 1.0, owner: "checkout" },',
          '   promo_banner_v2: { rollout: 0.5, owner: "growth" },',
          '+  /** LoopMate experiment: "Order again" rail on the home screen. */',
          "+  order_again_home: {",
          `+    rollout: ${HAPPY_PATH_TRAFFIC_PERCENT / 100},`,
          '+    owner: "home",',
          '+    metrics: { primary: "reorders_per_user", guardrail: "checkout_errors" },',
          "+  },",
          " } as const;",
          " ",
          " export type FlagName = keyof typeof flags;",
        ],
        "export const flags = {",
      ),
    ]),
    addedFile("src/features/home/__tests__/OrderAgainRail.test.tsx", [
      'import { fireEvent, render, screen } from "@testing-library/react";',
      'import { expect, it, vi } from "vitest";',
      'import { reorder } from "@/orders/reorder";',
      'import { OrderAgainRail } from "../OrderAgainRail";',
      "",
      'vi.mock("@/orders/reorder", () => ({ reorder: vi.fn() }));',
      'vi.mock("@/analytics/track", () => ({ track: vi.fn() }));',
      "",
      "const order = {",
      '  id: "o1",',
      '  summary: "Pad thai, spring rolls",',
      '  restaurant: { name: "Thai Basil", imageUrl: "/thai.png" },',
      "};",
      "",
      'it("reorders a past order in one tap", () => {',
      "  render(<OrderAgainRail orders={[order]} />);",
      '  fireEvent.click(screen.getByRole("button", { name: "Reorder" }));',
      '  expect(reorder).toHaveBeenCalledWith("o1");',
      "});",
    ]),
  ];
}
/** Full simulated PR for the happy path, including review content. */
export function orderAgainPr(): SimulatedPr {
  const diffs = orderAgainDiffs();
  return {
    title: `Experiment: "Order again" on the home screen (${HAPPY_PATH_TRAFFIC_PERCENT}%)`,
    summary:
      'Adds an "Order again" row of recent orders to the top of the home screen behind the order_again_home flag. Deltas are illustrative sample data, not measured.',
    files: diffs.map((d) => d.path),
    branch: "loopmate/experiment-order-again-home",
    status: "open",
    diffs,
    analytics: orderAgainAnalytics(),
    checks: SIMULATED_CHECKS.map((c) => ({ ...c })),
  };
}

function buildPr(
  kind: SimulatedKind,
  test: SuggestedTest,
  title: string,
  screen: string,
  deltas: SimulatedDelta[],
  recordings: SimulatedRun["recordings"],
): SimulatedPr {
  const name = slug(screen);
  const diffs = generatedDiffs(kind, test, screen);
  const files = diffs.map((d) => d.path);
  return {
    diffs,
    analytics: generatedAnalytics(kind, deltas, recordings),
    checks: SIMULATED_CHECKS.map((c) => ({ ...c })),
    title: kind === "experiment" ? `Experiment: ${shorten(test.change)}` : `Fix: ${shorten(title)}`,
    summary:
      kind === "experiment"
        ? `Ships the variant from the approved A/B test. Hypothesis: ${test.hypothesis} Primary metric: ${test.primary_metric}.${test.guardrail_metric ? ` Guardrail: ${test.guardrail_metric}.` : ""} Deltas are illustrative sample data, not measured.`
        : `Implements the fix: ${test.change}${test.primary_metric ? ` Verification metric: ${test.primary_metric}.` : ""} Verification deltas are illustrative sample data, not measured.`,
    files,
    branch: `loopmate/${kind}-${name}`,
    status: "open",
  };
}

export interface BuildRunInput {
  kind: SimulatedKind;
  test: SuggestedTest;
  finding_title: string;
  screen?: string | undefined;
  session_id: string | null;
  finding_id: string | null;
  product_id: ProductId | null;
  started_at: string;
  sample?: boolean;
  idea_source?: SimulatedRun["idea_source"];
  pr_status?: SimulatedPrStatus;
  /** Happy path only: replaces the generated PR, deltas and recording counts. */
  happy_path?: boolean;
  insight_source?: SimulatedRun["insight_source"];
  pr?: SimulatedPr | undefined;
  deltas?: SimulatedDelta[] | undefined;
  recordings?: SimulatedRun["recordings"] | undefined;
}
/** Pure builder (no storage). */
export function buildSimulatedRun(input: BuildRunInput): SimulatedRun {
  const hash = contentHash(`${input.kind}|${input.test.change}`);
  const experiment = input.kind === "experiment";
  const screen = input.test.target_screen?.trim() || input.screen?.trim() || input.finding_title;
  const recordings: SimulatedRun["recordings"] =
    input.recordings ??
    (experiment
      ? { control: pick(hash, 8, 40, 90), variant: pick(hash, 9, 10, 24), illustrative: true }
      : { control: pick(hash, 8, 4, 9), variant: pick(hash, 9, 4, 9), illustrative: true });
  const deltas = input.deltas ?? illustrativeDeltas(input.kind, input.test);
  const pr =
    input.pr ?? buildPr(input.kind, input.test, input.finding_title, screen, deltas, recordings);
  return {
    id: crypto.randomUUID(),
    simulated: true,
    kind: input.kind,
    scout: experiment ? "experimenter" : "fixer",
    session_id: input.session_id,
    finding_id: input.finding_id,
    product_id: input.product_id,
    finding_title: input.finding_title,
    test: { ...input.test },
    ...(experiment ? { traffic_percent: EXPERIMENT_TRAFFIC_PERCENT } : {}),
    started_at: input.started_at,
    duration_ms: experiment ? EXPERIMENT_DURATION_MS : FIX_DURATION_MS,
    recordings,
    deltas,
    pr: { ...pr, status: input.pr_status ?? "open" },
    ...(input.sample ? { sample: true } : {}),
    ...(input.idea_source ? { idea_source: input.idea_source } : {}),
    ...(input.happy_path ? { happy_path: true } : {}),
    ...(input.insight_source ? { insight_source: input.insight_source } : {}),
  };
}

// ---- Storage (separate localStorage key; memory fallback when storage is unavailable) ----

const CHANGE_EVENT = "loopmate-simulated-demo-change";
/** Human decision on a sample (fictional) insight, kept with the other simulated records. */
export interface SampleDecisionRecord {
  review_status: "pending" | "accepted" | "rejected";
  decision: "pending" | "approved" | "rejected";
  decided_at?: string | undefined;
  /** Reviewer's edits to the sample test (kept across navigation, reload and approval). */
  edited_test?: SuggestedTest | undefined;
}
export interface SimulationStore {
  runs: SimulatedRun[];
  /** Keyed by sample finding id (e.g. "order-again"). */
  samples: Record<string, SampleDecisionRecord>;
}
const emptyStore = (): SimulationStore => ({ runs: [], samples: {} });
let memory: SimulationStore | null = null;
/** True when the last write could not reach localStorage (e.g. quota); memory is then newer. */
let writeFailed = false;
export const SIMULATION_CHANGE_EVENT = CHANGE_EVENT;

function isRun(value: unknown): value is SimulatedRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<SimulatedRun>;
  return (
    run.simulated === true &&
    typeof run.id === "string" &&
    (run.kind === "experiment" || run.kind === "fix") &&
    typeof run.started_at === "string" &&
    typeof run.duration_ms === "number" &&
    !!run.test &&
    !!run.pr &&
    Array.isArray(run.deltas)
  );
}
const reviewStatuses = ["pending", "accepted", "rejected"] as const;
const decisions = ["pending", "approved", "rejected"] as const;
function isTest(value: unknown): value is SuggestedTest {
  if (!value || typeof value !== "object") return false;
  const test = value as Partial<SuggestedTest>;
  return (
    typeof test.change === "string" &&
    typeof test.hypothesis === "string" &&
    typeof test.primary_metric === "string"
  );
}
function isSampleDecision(value: unknown): value is SampleDecisionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SampleDecisionRecord>;
  return (
    (reviewStatuses as readonly unknown[]).includes(record.review_status) &&
    (decisions as readonly unknown[]).includes(record.decision) &&
    (record.edited_test === undefined || isTest(record.edited_test))
  );
}
/** Tolerant parse of the whole simulated store (older payloads have only `runs`). */
export function parseSimulationStore(raw: string | null): SimulationStore {
  if (!raw) return emptyStore();
  try {
    const data = JSON.parse(raw) as { runs?: unknown; samples?: unknown } | null;
    const runs = Array.isArray(data?.runs) ? data.runs.filter(isRun) : [];
    const samples: Record<string, SampleDecisionRecord> = {};
    if (data?.samples && typeof data.samples === "object")
      for (const [id, record] of Object.entries(data.samples as Record<string, unknown>))
        if (isSampleDecision(record)) samples[id] = record;
    return { runs, samples };
  } catch {
    return emptyStore();
  }
}
export function parseSimulatedRuns(raw: string | null): SimulatedRun[] {
  return parseSimulationStore(raw).runs;
}
const serialize = (store: SimulationStore) => JSON.stringify({ version: 1, ...store });
export function readSimulatedRaw(): string | null {
  if (writeFailed && memory) return serialize(memory);
  try {
    return window.localStorage.getItem(SIMULATION_KEY);
  } catch {
    return memory ? serialize(memory) : null;
  }
}
export const readSimulationStore = () => parseSimulationStore(readSimulatedRaw());
export function listSimulatedRuns(): SimulatedRun[] {
  return readSimulationStore().runs;
}
function writeStore(store: SimulationStore) {
  memory = store;
  try {
    window.localStorage.setItem(SIMULATION_KEY, serialize(store));
    writeFailed = false;
  } catch {
    /* Kept in memory for this page; reads prefer it until a write succeeds. */
    writeFailed = true;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}
/** Replaces the runs, keeping sample decisions. */
function write(runs: SimulatedRun[]) {
  writeStore({ ...readSimulationStore(), runs });
}

export interface StartRunContext {
  product_id: ProductId | null;
  now?: Date | undefined;
  /** Marks a run whose idea came from competitor footage (Explorer). */
  idea_source?: SimulatedRun["idea_source"];
}
/** Explorer provenance for runs started from a competitor-derived insight; undefined otherwise. */
export function ideaSourceFor(
  session: Pick<Session, "source_app" | "public_video">,
): SimulatedRun["idea_source"] {
  return isCompetitorSession(session)
    ? { scout: "explorer", label: `${session.source_app} public footage` }
    : undefined;
}
/**
 * Starts a labeled client-side simulated run for an approved finding. Idempotent: returns the
 * existing open run for the same finding, kind and test snapshot. No network call.
 */
export function startSimulatedRun(
  finding: Finding,
  route: SuggestedRoute,
  context: StartRunContext,
): SimulatedRun {
  const approved = effectiveTest(finding);
  const test: SuggestedTest | undefined =
    route === "fix"
      ? approved?.change?.trim()
        ? approved
        : finding.recommendation?.trim()
          ? { hypothesis: "", change: finding.recommendation, primary_metric: "" }
          : undefined
      : approved;
  if (!test) throw new Error("This insight has no test or fix to simulate.");
  const runs = listSimulatedRuns();
  const snapshot = JSON.stringify(test);
  const existing = runs.find(
    (run) =>
      run.finding_id === finding.id &&
      run.kind === route &&
      run.pr.status !== "closed" &&
      JSON.stringify(run.test) === snapshot,
  );
  if (existing) return existing;
  const run = buildSimulatedRun({
    kind: route,
    test,
    finding_title: finding.title,
    screen: finding.screen,
    session_id: finding.session_id,
    finding_id: finding.id,
    product_id: context.product_id,
    started_at: (context.now ?? new Date()).toISOString(),
    ...(context.idea_source ? { idea_source: context.idea_source } : {}),
  });
  write([...runs, run]);
  return run;
}
function setPrStatus(id: string, status: SimulatedPrStatus, now = Date.now()) {
  const runs = listSimulatedRuns();
  const run = runs.find((r) => r.id === id);
  if (!run) throw new Error("This simulated run is no longer available.");
  if (status === "merged" && !runStage(run, now).prReady)
    throw new Error("The simulated PR is not ready yet.");
  const at = new Date(now).toISOString();
  const updated: SimulatedRun = {
    ...run,
    pr: {
      ...run.pr,
      status,
      updated_at: at,
      ...(status === "merged" ? { merged_at: at } : {}),
    },
  };
  write(runs.map((r) => (r.id === id ? updated : r)));
  return updated;
}
/** Marks the simulated PR merged. No repository is touched. */
export const mergePr = (id: string, now?: number) => setPrStatus(id, "merged", now);
/** Marks the simulated PR closed. */
export const closePr = (id: string, now?: number) => setPrStatus(id, "closed", now);
/** Removes simulated runs for a finding (e.g. when its approval is withdrawn). */
export function discardRunsForFinding(findingId: string) {
  const runs = listSimulatedRuns();
  const kept = runs.filter((run) => run.finding_id !== findingId);
  if (kept.length !== runs.length) write(kept);
}
/** Removes simulated runs that came from a deleted recording. */
export function discardRunsForSession(sessionId: string) {
  const runs = listSimulatedRuns();
  const kept = runs.filter((run) => run.session_id !== sessionId);
  if (kept.length !== runs.length) write(kept);
}
/** Settings → "Reset simulated demo data". Research sessions are untouched. */
export function resetSimulatedDemo() {
  memory = null;
  writeFailed = false;
  try {
    window.localStorage.removeItem(SIMULATION_KEY);
  } catch {
    /* Nothing stored. */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}
// ---- Happy path: sample insight decision and run (fictional, local only) ----

/** Default (undecided) record for a sample insight. */
const pendingSample = (): SampleDecisionRecord => ({
  review_status: "pending",
  decision: "pending",
});
/** Stored decision for a sample insight (pending when none). */
export function sampleDecisionOf(
  store: SimulationStore,
  findingId: string = ORDER_AGAIN_FINDING_ID,
): SampleDecisionRecord {
  return store.samples[findingId] ?? pendingSample();
}
function writeSample(findingId: string, record: SampleDecisionRecord) {
  const store = readSimulationStore();
  writeStore({ ...store, samples: { ...store.samples, [findingId]: record } });
  return record;
}
/** The happy-path run (latest not-closed run for the sample insight), if any. */
export function happyPathRun(runs: SimulatedRun[]): SimulatedRun | undefined {
  return runs
    .filter((run) => run.happy_path && run.finding_id === ORDER_AGAIN_FINDING_ID)
    .filter((run) => run.pr.status !== "closed")
    .at(-1);
}
/** Pure builder for the happy-path run (Order again experiment, Experimenter). */
export function buildHappyPathRun(now: Date = new Date(), test?: SuggestedTest): SimulatedRun {
  const sample = getSampleInsight(SAMPLE_SESSION_ID, ORDER_AGAIN_FINDING_ID)!;
  const analytics = orderAgainAnalytics();
  return buildSimulatedRun({
    kind: "experiment",
    // The reviewer's edited test, when given, is the approved snapshot; the illustrative PR,
    // analytics and deltas stay the fixed sample ones.
    test: test ? { ...test } : orderAgainTest(),
    finding_title: sample.title,
    screen: sample.screen,
    session_id: SAMPLE_SESSION_ID,
    finding_id: ORDER_AGAIN_FINDING_ID,
    product_id: sample.product_id,
    started_at: now.toISOString(),
    idea_source: { scout: "explorer", label: `${sample.competitor} public footage (sample)` },
    happy_path: true,
    insight_source: "both",
    pr: orderAgainPr(),
    deltas: analytics.metrics.map((m) => ({ ...m })),
    recordings: { control: 42, variant: 11, illustrative: true },
  });
}
/**
 * Approves the sample "Order again" test and starts its simulated experiment run. Idempotent:
 * returns the existing open/merged happy-path run. Local only; no network, repository or deploy.
 */
export function startSampleTestRun(now: Date = new Date(), test?: SuggestedTest): SimulatedRun {
  approveSampleTest(now, test);
  const runs = listSimulatedRuns();
  const existing = happyPathRun(runs);
  if (existing) return existing;
  const run = buildHappyPathRun(now, test);
  write([...runs, run]);
  return run;
}
/**
 * Records approval of the sample test without starting a run (used when the Experimenter is
 * turned off in Settings, matching real findings: approval saved, no run started).
 */
export function approveSampleTest(now: Date = new Date(), test?: SuggestedTest) {
  const edited = test ?? sampleDecisionOf(readSimulationStore()).edited_test;
  return writeSample(ORDER_AGAIN_FINDING_ID, {
    review_status: "accepted",
    decision: "approved",
    decided_at: now.toISOString(),
    ...(edited ? { edited_test: { ...edited } } : {}),
  });
}
/**
 * Saves (or, with undefined, clears) the reviewer's edits to the sample test without deciding.
 * Local simulated store only.
 */
export function saveSampleTestDraft(test: SuggestedTest | undefined) {
  const current = sampleDecisionOf(readSimulationStore());
  const rest: SampleDecisionRecord = { ...current };
  delete rest.edited_test;
  return writeSample(ORDER_AGAIN_FINDING_ID, test ? { ...rest, edited_test: { ...test } } : rest);
}
/**
 * Demo control: moves a simulated run's start back so it reaches its final stage (PR ready)
 * now. Changes only the local simulated record. Returns the updated run, or null.
 */
export function fastForwardRun(id: string, now: number = Date.now()): SimulatedRun | null {
  const runs = listSimulatedRuns();
  const run = runs.find((item) => item.id === id);
  if (!run) return null;
  const updated = { ...run, started_at: new Date(now - run.duration_ms).toISOString() };
  write(runs.map((item) => (item.id === id ? updated : item)));
  return updated;
}
/** Rejects the sample test; any happy-path run is discarded. */
export function rejectSampleTest(now: Date = new Date()) {
  discardRunsForFinding(ORDER_AGAIN_FINDING_ID);
  return writeSample(ORDER_AGAIN_FINDING_ID, {
    review_status: "rejected",
    decision: "rejected",
    decided_at: now.toISOString(),
  });
}
/** Returns the sample insight to pending and discards its runs (demo restart). */
export function resetSampleTest() {
  discardRunsForFinding(ORDER_AGAIN_FINDING_ID);
  return writeSample(ORDER_AGAIN_FINDING_ID, pendingSample());
}

export const runsForProduct = (runs: SimulatedRun[], productId: ProductId | null) =>
  productId ? runs.filter((run) => run.product_id === productId) : [];
export const runsForFinding = (runs: SimulatedRun[], findingId: string) =>
  runs.filter((run) => run.finding_id === findingId);

type SampleSpec = Omit<
  BuildRunInput,
  "started_at" | "product_id" | "session_id" | "finding_id" | "sample"
>;
const sampleSpecs: Record<ProductId, SampleSpec[]> = {
  "uber-eats": [
    {
      kind: "experiment",
      finding_title: "Sample: delivery fee on store cards",
      screen: "Store list",
      idea_source: { scout: "explorer", label: "DoorDash public footage (sample)" },
      test: {
        hypothesis:
          "If we show the delivery fee on each store card, then fewer customers abandon at checkout because the fee is no longer a surprise.",
        change: `Show the delivery fee under each store name in the store list for ${EXPERIMENT_TRAFFIC_PERCENT}% of traffic; control keeps the current cards.`,
        primary_metric: "checkout abandonment after fee is shown",
        guardrail_metric: "store card taps",
        target_screen: "Store list",
      },
    },
    {
      kind: "fix",
      finding_title: "Sample: quantity stepper target is too small",
      screen: "Item details",
      idea_source: { scout: "tracker", label: "Uber Eats footage (sample)" },
      pr_status: "merged",
      test: {
        hypothesis: "Users change item quantity without missed or repeated taps.",
        change:
          "Enlarge the quantity stepper buttons to a comfortable tap target and add spacing between minus and plus.",
        primary_metric: "missed or repeated taps on the stepper",
        target_screen: "Item details",
      },
    },
  ],
  checkout: [
    {
      kind: "fix",
      finding_title: 'Sample: "Add to bag" button is easy to miss',
      screen: "Item details",
      idea_source: { scout: "tracker", label: "Bag Checkout recordings (sample)" },
      test: {
        hypothesis: "Users add the item on the first tap.",
        change: 'Make the "Add to bag" button full width with a larger tap target.',
        primary_metric: "missed taps before adding to bag",
        target_screen: "Item details",
      },
    },
    {
      kind: "experiment",
      finding_title: "Sample: delivery estimate on the review screen",
      screen: "Review order",
      idea_source: { scout: "tracker", label: "Bag Checkout recordings (sample)" },
      test: {
        hypothesis:
          "If we show the delivery estimate next to the order total, then fewer users go back to the delivery step because the key detail is visible where they decide.",
        change: `Show the delivery estimate beside the total on the review screen for ${EXPERIMENT_TRAFFIC_PERCENT}% of traffic.`,
        primary_metric: "backtracks from review to delivery",
        guardrail_metric: "order placement errors",
        target_screen: "Review order",
      },
    },
  ],
};
/**
 * Seeds 1–2 completed, labeled sample runs for a product (one fix, one experiment). Idempotent:
 * returns existing samples when the product already has them. Samples link to no real finding.
 */
export function seedSampleLoop(productId: ProductId, now: Date = new Date()): SimulatedRun[] {
  const runs = listSimulatedRuns();
  const existing = runs.filter((run) => run.sample && run.product_id === productId);
  if (existing.length) return existing;
  const samples = sampleSpecs[productId].map((spec, i) =>
    buildSimulatedRun({
      ...spec,
      product_id: productId,
      session_id: null,
      finding_id: null,
      sample: true,
      // Already finished: started well before now.
      started_at: new Date(now.getTime() - EXPERIMENT_DURATION_MS - 60000 * (i + 1)).toISOString(),
    }),
  );
  write([...runs, ...samples]);
  return samples;
}
