import type { ProductId } from "./products";
export const categories = [
  "long_loading",
  "silent_form_rejection",
  "silent_failure",
  "fighting_ui",
  "missed_button",
  "rage_or_hesitation",
  "dead_click",
  "missing_context",
  "text_clipping",
] as const;
export type Category = (typeof categories)[number];
export const scenarios: { id: Category; name: string; detail: string; screen: string }[] = [
  {
    id: "long_loading",
    name: "Long loading",
    detail: "A visible loading state delays item details.",
    screen: "item_details",
  },
  {
    id: "silent_form_rejection",
    name: "Silent form rejection",
    detail: "A valid-looking postal code is rejected without feedback.",
    screen: "delivery_form",
  },
  {
    id: "silent_failure",
    name: "Request timeout",
    detail: "The order stalls after a simulated request times out.",
    screen: "review_order",
  },
  {
    id: "fighting_ui",
    name: "Fighting modal",
    detail: "A promotional overlay returns after dismissal.",
    screen: "browse",
  },
  {
    id: "missed_button",
    name: "Missed button",
    detail: "A small checkout target allows near-misses.",
    screen: "item_details",
  },
];
export const deliveryScenarios: typeof scenarios = [
  {
    id: "dead_click",
    name: "Looks clickable",
    detail: "Food images and the offer banner do not open anything.",
    screen: "delivery_menu",
  },
  {
    id: "missing_context",
    name: "Missing item details",
    detail: "The basket omits size and serving information, prompting a return to details.",
    screen: "delivery_basket",
  },
  {
    id: "text_clipping",
    name: "Clipped names and addresses",
    detail: "Long item names and a synthetic delivery address are truncated in the basket.",
    screen: "delivery_basket",
  },
];
export const demoSources = {
  delivery: "Miso food delivery",
  checkout: "Bag checkout app",
} as const;
export type DemoKind = keyof typeof demoSources;
export interface SessionEvent {
  id: string;
  session_id: string;
  t_ms: number;
  type: string;
  screen: string;
  target_id?: string | undefined;
  x?: number;
  y?: number;
  operation_id?: string | undefined;
  metadata?: Record<string, string | number | boolean> | undefined;
}
export interface ActionDraft {
  title: string;
  scope: string;
  status: "draft" | "approved" | "dismissed";
  updated_at: string;
}
/** Model-proposed A/B test. The model original is stored verbatim and never mutated. */
export interface SuggestedTest {
  hypothesis: string;
  change: string;
  primary_metric: string;
  guardrail_metric?: string | undefined;
  target_screen?: string | undefined;
}
/** fix = clear problem, build it directly (Fixer); experiment = open question, A/B test it (Experimenter). */
export const suggestedRoutes = ["fix", "experiment"] as const;
export type SuggestedRoute = (typeof suggestedRoutes)[number];
export const suggestedRouteLabels: Record<SuggestedRoute, string> = {
  fix: "Fix directly",
  experiment: "Run an A/B test",
};
/** Human decision about a suggested test, stored separately from the model original. */
export interface TestDecision {
  decision: "pending" | "approved" | "rejected";
  edited: boolean;
  /** Reviewer copy; present only when edited. */
  edited_test?: SuggestedTest | undefined;
  /** Reviewer's route choice when it differs from (or confirms over) the model's suggested_route. */
  route_override?: SuggestedRoute | undefined;
  decided_at?: string | undefined;
}
/** Allow-listed analysis emphasis lenses. Never free text. */
export const agentFocusAreas = [
  "navigation",
  "layout_hierarchy",
  "target_size",
  "copy",
  "accessibility",
  "feedback_responsiveness",
  "effort",
  "discoverability",
  "trust",
  "engagement",
  "bugs",
] as const;
export type AgentFocus = (typeof agentFocusAreas)[number];
export const agentFocusLabels: Record<AgentFocus, string> = {
  navigation: "Navigation",
  layout_hierarchy: "Layout and hierarchy",
  target_size: "Target size",
  copy: "Copy and labels",
  accessibility: "Accessibility",
  feedback_responsiveness: "Feedback and responsiveness",
  effort: "Effort",
  discoverability: "Discoverability",
  trust: "Trust",
  engagement: "Engagement",
  bugs: "Bugs",
};
export function isAgentFocus(value: unknown): value is AgentFocus {
  return typeof value === "string" && (agentFocusAreas as readonly string[]).includes(value);
}
export interface Finding {
  id: string;
  session_id: string;
  analysis_run_id: string;
  category: string;
  recommendation?: string | undefined;
  expected_benefit?: string | undefined;
  title: string;
  description: string;
  timestamp_ms: number;
  end_timestamp_ms?: number | undefined;
  screen?: string | undefined;
  confidence: number;
  visual_evidence: string;
  event_ids: string[];
  why_video_matters: string;
  evidence_sources: ("video" | "events")[];
  review_status: "pending" | "accepted" | "rejected";
  reviewer_note?: string;
  next_step?: ActionDraft;
  observed_evidence?: string | undefined;
  interpretation?: string | undefined;
  severity?: "minor" | "major" | "blocker";
  /** Model original (verbatim from the validated output). */
  suggested_test?: SuggestedTest | undefined;
  /** Model original route proposal. The reviewer's choice lives in test_decision.route_override. */
  suggested_route?: SuggestedRoute | undefined;
  /** Human decision and optional edited copy. */
  test_decision?: TestDecision | undefined;
}
export interface GroundTruthIssue {
  id: string;
  category: string;
  screen: string;
  actually_observed: "yes" | "no" | "unknown";
  notes?: string;
}
export interface FindingMatch {
  finding_id: string;
  ground_truth_issue_id: string | null;
  reviewer_verified: boolean;
  video_necessary: "yes" | "no" | "unknown";
  evidence_verified: boolean;
  evidence_judged?: boolean;
}
export interface AnalysisRun {
  id: string;
  mode: "video_frames_plus_events" | "events_only" | "public_video";
  model_name: string;
  status: "completed" | "failed";
  frame_count?: number;
  started_at: string;
  completed_at: string;
  latency_ms?: number;
  error?: string;
  raw_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  frame_timestamps_ms?: number[];
  input_fingerprint?: string;
  source_clip?: { url: string; start_ms: number; end_ms: number };
  /** Provenance: emphasis lenses the server applied (allow-listed enum). */
  focus_areas?: AgentFocus[] | undefined;
  /** Provenance: set when the footage was analyzed as a competitor of this product (Explorer). */
  competitor_of?: ProductId | undefined;
  /**
   * False on a failed run that stopped at a local pre-check (no request was sent). Such runs never
   * count toward a scout's daily cap. Absent on older runs, which are counted conservatively.
   */
  reached_provider?: boolean | undefined;
}
export interface Session {
  id: string;
  title: string;
  created_at: string;
  captured_at: string;
  duration_ms: number;
  video_blob: Blob;
  mime_type: string;
  extension: string;
  capture_mode: string;
  source_app: string;
  scenario_config: Category[];
  loading_delay_ms: number;
  status: "captured" | "analyzed" | "reviewed";
  consent_confirmed: boolean;
  event_count: number;
  events: SessionEvent[];
  findings: Finding[];
  issues: GroundTruthIssue[];
  matches: FindingMatch[];
  runs: AnalysisRun[];
  video_start_offset_ms: number;
  capture_region?: { x: number; y: number; width: number; height: number };
  capture_region_valid_from_ms?: number;
  capture_end_reason?:
    "manual" | "browser_stop" | "source_changed" | "recorder_error" | "navigation";
  public_video?: {
    url: string;
    video_id: string;
    creator: string;
    published_label: string;
    context: string;
    start_ms: number;
    end_ms: number;
    duration_verified: boolean;
    footage_reviewed_at: string;
    /** Set when this is a competitor's public footage (Explorer), e.g. DoorDash for Uber Eats. */
    competitor_of?: ProductId | undefined;
  };
  sync?: { state: "synced" | "local_changes"; synced_at: string };
  /**
   * Provenance for real model output that was generated ahead of time and imported into this
   * browser (e.g. the Uber Eats Tracker runs). The run and findings are unaltered model output;
   * these sessions never count toward a scout's daily analysis cap.
   */
  pregenerated?:
    | {
        /** Which bundled pre-generated file: Tracker (Uber Eats) or Explorer (DoorDash). */
        source: "uber-eats-tracker-runs" | "doordash-explorer-runs";
        /** When the runs were generated (ISO). */
        generated_at: string;
        note: string;
        /** The imported run ids. Only these are exempt from the cap; later re-analyses count. */
        run_ids: string[];
        /** When this browser imported them (ISO). */
        imported_at?: string | undefined;
      }
    | undefined;
}
export interface SamplingSettings {
  interval_seconds: number;
  max_frames: number;
  max_width: number;
}
export const defaultSampling: SamplingSettings = {
  interval_seconds: 2,
  max_frames: 24,
  max_width: 960,
};
export const duration = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
export const label = (s: string) => s.replaceAll("_", " ");

export type AnalysisMode = AnalysisRun["mode"];
