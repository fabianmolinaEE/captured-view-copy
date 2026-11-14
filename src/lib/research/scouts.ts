/**
 * The four LoopMate scouts (docs/AUTOMATED-LOOP.md §1.1). Two find what to
 * improve, two change the product. This module is presentation metadata only:
 * it holds no research data, counters or agent activity.
 */

export type ScoutId = "tracker" | "explorer" | "fixer" | "experimenter";
export type ScoutBucket = "find" | "change";
/** Prototype status per §1.1: real Gemini analysis, labeled simulation, or back burner. */
export type ScoutStatus = "real" | "simulated" | "back_burner";
/** The workspace area that shows each scout's output. */
export type ScoutArea = "Insights" | "A/B Tests" | "Rollouts";

export interface ScoutColors {
  /** Primary hue, tuned for contrast on the dark navy `data-theme="loop"` canvas. */
  main: string;
  /** Darker shade of the hue (cape shading, text on a `main` fill). */
  deep: string;
  /** Soft translucent tint for card/halo backgrounds. */
  tint: string;
  /** Translucent border ring. */
  ring: string;
}

export interface Scout {
  id: ScoutId;
  name: string;
  bucket: ScoutBucket;
  bucketLabel: string;
  /** "1" for find, "2" for change, matching the §1.1 bucket numbering. */
  bucketNumber: 1 | 2;
  tagline: string;
  /** One-line role description used in tooltips, settings and detail views. */
  role: string;
  /** Plain color name for accessible titles and legends. */
  colorName: "blue" | "green" | "orange" | "purple";
  colors: ScoutColors;
  status: ScoutStatus;
  /** Honest status explanation shown next to the status pill. */
  statusNote: string;
  area: ScoutArea;
  /** Loop stages from AUTOMATED-LOOP §1 that the scout covers. */
  stages: readonly number[];
}

export const scoutBuckets: readonly {
  id: ScoutBucket;
  number: 1 | 2;
  label: string;
  scouts: readonly ScoutId[];
}[] = [
  { id: "find", number: 1, label: "Find what to improve", scouts: ["tracker", "explorer"] },
  { id: "change", number: 2, label: "Change the product", scouts: ["fixer", "experimenter"] },
] as const;

export const scoutsSummary = "Two find what to improve. Two change it.";

export const scoutStatusLabels: Record<ScoutStatus, string> = {
  real: "Real",
  simulated: "Simulated demo",
  back_burner: "Back burner",
};

export const scouts: readonly Scout[] = [
  {
    id: "tracker",
    name: "Tracker",
    bucket: "find",
    bucketLabel: "Find what to improve",
    bucketNumber: 1,
    tagline: "Watches your product. Finds where users struggle.",
    role: "Watches your product's recordings and finds where users struggle or where the experience could improve.",
    colorName: "blue",
    colors: { main: "#5aa9ff", deep: "#1f5fae", tint: "#5aa9ff1f", ring: "#5aa9ff59" },
    status: "real",
    statusNote: "Gemini insight analysis with suggested tests. Collection runner not connected.",
    area: "Insights",
    stages: [1, 2, 3],
  },
  {
    id: "explorer",
    name: "Explorer",
    bucket: "find",
    bucketLabel: "Find what to improve",
    bucketNumber: 1,
    tagline: "Watches competitors. Learns from their user flow.",
    role: "Watches competitors' public product footage and learns from their flows.",
    colorName: "green",
    colors: { main: "#4fd18b", deep: "#1c7a4b", tint: "#4fd18b1f", ring: "#4fd18b59" },
    status: "real",
    statusNote:
      "Gemini analysis of DoorDash public videos. Shown in Insights; never counted as your users.",
    area: "Insights",
    stages: [1, 2, 3],
  },
  {
    id: "fixer",
    name: "Fixer",
    bucket: "change",
    bucketLabel: "Change the product",
    bucketNumber: 2,
    tagline: "Clear bug? Builds a fix.",
    role: "Bugs only: turns a clear bug straight into a fix PR, with no A/B test needed.",
    colorName: "orange",
    colors: { main: "#ff9a4d", deep: "#b3561a", tint: "#ff9a4d1f", ring: "#ff9a4d59" },
    status: "simulated",
    statusNote: "Fix PRs are labeled simulated demo data. No repository is connected.",
    area: "Rollouts",
    stages: [7, 8],
  },
  {
    id: "experimenter",
    name: "Experimenter",
    bucket: "change",
    bucketLabel: "Change the product",
    bucketNumber: 2,
    tagline: "Open question? Designs, runs and analyses the test.",
    role: "Designs, runs and analyses an A/B test for an open question, then drafts the rollout PR.",
    colorName: "purple",
    colors: { main: "#b48cff", deep: "#6a3fc4", tint: "#b48cff1f", ring: "#b48cff59" },
    status: "simulated",
    statusNote:
      "Experiment runs, deltas and PRs are labeled simulated demo data. Nothing is deployed.",
    area: "A/B Tests",
    stages: [5, 6, 7],
  },
] as const;

export const scoutIds: readonly ScoutId[] = scouts.map((scout) => scout.id);

export function isScoutId(value: unknown): value is ScoutId {
  return typeof value === "string" && (scoutIds as readonly string[]).includes(value);
}

export function getScout(id: ScoutId): Scout {
  const scout = scouts.find((item) => item.id === id);
  if (!scout) throw new Error(`Unknown scout: ${id}`);
  return scout;
}

export function scoutsInBucket(bucket: ScoutBucket): Scout[] {
  return scouts.filter((scout) => scout.bucket === bucket);
}

/** Insight routing (§1.1): fix → Fixer, experiment → Experimenter. */
export function scoutForRoute(route: "fix" | "experiment"): Scout {
  return getScout(route === "fix" ? "fixer" : "experimenter");
}
