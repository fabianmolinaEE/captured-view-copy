import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, PencilLine, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/use-product";
import { useSimulation } from "@/hooks/use-simulation";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { getScout } from "@/lib/research/scouts";
import {
  SAMPLE_NOTE,
  type SampleInsight,
  type StoryboardFrame,
  type StoryboardScene,
} from "@/lib/research/demo/happyPath";
import type { SuggestedTest } from "@/lib/research/types";
import { Shell } from "./Shell";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";
import { RouteBadge } from "./SuggestedTestPanel";
import { SourceMarker, VideoCount } from "./SourceMarker";
import { decisionState } from "@/lib/research/sourceMarkers";
import { useInsightsBackSearch } from "@/hooks/use-insights-back-search";

const tracker = getScout("tracker");
const explorer = getScout("explorer");
const experimenter = getScout("experimenter");
const accentFor = (scout: StoryboardFrame["scout"]) =>
  scout === "tracker"
    ? tracker.colors.main
    : scout === "explorer"
      ? explorer.colors.main
      : experimenter.colors.main;

const block = "#ffffff1f";
const faint = "#ffffff12";

/** Simple drawn phone content per illustrative scene (no real footage, no images). */
function SceneContent({ scene, accent }: { scene: StoryboardScene; accent: string }) {
  switch (scene) {
    case "home_scroll":
      return (
        <>
          <rect x="12" y="34" width="96" height="10" rx="5" fill={faint} />
          {[50, 84, 118, 152].map((y) => (
            <rect key={y} x="12" y={y} width="96" height="28" rx="5" fill={block} />
          ))}
          <path
            d="M100 70 v60 m-6 -8 l6 8 l6 -8"
            stroke={accent}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="78" cy="118" r="7" fill={`${accent}55`} stroke={accent} strokeWidth="1.5" />
        </>
      );
    case "search_restaurant":
      return (
        <>
          <rect x="12" y="34" width="96" height="14" rx="7" fill={faint} stroke={accent} />
          <rect x="20" y="39" width="38" height="4" rx="2" fill={accent} />
          <rect x="61" y="37" width="1.5" height="8" fill="#fff" />
          {[58, 82, 106, 130].map((y) => (
            <g key={y}>
              <rect x="12" y={y} width="18" height="18" rx="4" fill={block} />
              <rect x="36" y={y + 3} width="56" height="5" rx="2.5" fill={block} />
              <rect x="36" y={y + 11} width="36" height="4" rx="2" fill={faint} />
            </g>
          ))}
        </>
      );
    case "rebuild_basket":
      return (
        <>
          {[36, 64, 92, 120].map((y, i) => (
            <g key={y}>
              <rect x="12" y={y} width="96" height="22" rx="5" fill={faint} />
              <rect x="18" y={y + 5} width="48" height="5" rx="2.5" fill={block} />
              <rect x="18" y={y + 13} width="28" height="4" rx="2" fill={block} />
              <circle
                cx="98"
                cy={y + 11}
                r="6"
                fill={i < 3 ? `${accent}55` : block}
                stroke={i < 3 ? accent : "none"}
              />
              <path d={`M95 ${y + 11} h6 M98 ${y + 8} v6`} stroke="#fff" strokeWidth="1.4" />
            </g>
          ))}
          <rect x="30" y="160" width="60" height="16" rx="8" fill={block} />
          <text x="60" y="171" textAnchor="middle" fontSize="7" fill="#e9dff5">
            Basket · 3
          </text>
        </>
      );
    case "competitor_reorder_row":
    case "variant_reorder_row":
      return (
        <>
          <text x="12" y="42" fontSize="8" fontWeight="600" fill={accent}>
            Order again
          </text>
          <rect
            x="8"
            y="47"
            width="104"
            height="44"
            rx="6"
            fill={`${accent}14`}
            stroke={accent}
            strokeDasharray={scene === "variant_reorder_row" ? "3 2" : undefined}
          />
          {[12, 46, 80].map((x) => (
            <g key={x}>
              <rect x={x} y="52" width="28" height="22" rx="4" fill={block} />
              <rect x={x} y="78" width="28" height="8" rx="4" fill={accent} opacity="0.85" />
            </g>
          ))}
          {[100, 134].map((y) => (
            <rect key={y} x="12" y={y} width="96" height="26" rx="5" fill={faint} />
          ))}
          {scene === "variant_reorder_row" && (
            <circle cx="26" cy="82" r="7" fill={`${accent}44`} stroke="#fff" strokeWidth="1.2" />
          )}
        </>
      );
  }
}

/** One illustrative storyboard frame: an inline SVG phone with caption. */
function StoryboardCard({ frame }: { frame: StoryboardFrame }) {
  const accent = accentFor(frame.scout);
  return (
    <figure className="m-0 w-[132px] shrink-0" data-scene={frame.scene} data-illustrative="true">
      <svg
        viewBox="0 0 120 190"
        role="img"
        aria-label={`Illustrative frame: ${frame.caption}`}
        className="block w-full"
      >
        <rect
          x="2"
          y="2"
          width="116"
          height="186"
          rx="14"
          fill="#17122a"
          stroke={`${accent}88`}
          strokeWidth="1.5"
        />
        <text x="12" y="22" fontSize="8" fontWeight="600" fill="#f0e8f9">
          {frame.screen}
        </text>
        <text x="108" y="22" fontSize="7" textAnchor="end" fill="#bdb3cf">
          {frame.time_label}
        </text>
        <SceneContent scene={frame.scene} accent={accent} />
      </svg>
      <figcaption className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {frame.caption}
      </figcaption>
    </figure>
  );
}

function EvidenceBlock({
  scoutId,
  heading,
  sourceLabel,
  text,
  frames,
}: {
  scoutId: "tracker" | "explorer";
  heading: string;
  sourceLabel: string;
  text: string;
  frames: StoryboardFrame[];
}) {
  const scout = scoutId === "tracker" ? tracker : explorer;
  return (
    <section
      aria-label={`${scout.name} evidence`}
      className="rounded-xl border p-4"
      style={{ borderColor: scout.colors.ring, background: scout.colors.tint }}
    >
      <div className="flex items-center gap-2">
        <ScoutMascot scout={scout} size={28} decorative halo={false} />
        <div>
          <h2 className="text-sm font-semibold" style={{ color: scout.colors.main }}>
            {heading}
          </h2>
          <p className="text-[11px] text-muted-foreground">{sourceLabel}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{text}</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1" aria-label="Illustrative storyboard">
        {frames.map((frame) => (
          <StoryboardCard key={frame.id} frame={frame} />
        ))}
      </div>
    </section>
  );
}

function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{name}</dt>
      <dd className="mt-1 leading-relaxed">{children}</dd>
    </div>
  );
}

const editable: { key: keyof SuggestedTest; label: string; multiline?: boolean }[] = [
  { key: "change", label: "Variant change", multiline: true },
  { key: "hypothesis", label: "Hypothesis", multiline: true },
  { key: "primary_metric", label: "Primary metric" },
  { key: "guardrail_metric", label: "Guardrail metric" },
];

/**
 * Detail page for the labeled fictional "Order again" sample (AUTOMATED-LOOP §3). Its evidence
 * is an illustrative storyboard, never highlights on real footage. Approving starts only the
 * client-side simulated happy-path run, followed on A/B Tests.
 */
export function SampleInsightDetail({ sample }: { sample: SampleInsight }) {
  const { selectProduct } = useProduct();
  // Adopt the sample's product on open only, so a later product switch is not undone.
  useEffect(() => {
    selectProduct(sample.product_id);
  }, [sample.product_id, selectProduct]);
  const backSearch = useInsightsBackSearch();
  const simulation = useSimulation();
  const decision = simulation.sampleDecision;
  const run = simulation.happyPathRun;
  const stage = run ? simulation.stageOf(run) : null;
  const [editing, setEditing] = useState(false);
  const experimenterOff = !useAgentSettings().settings.experimenter.enabled;
  // Edits live in the simulated store, so they survive navigation and reload.
  const savedTest = decision.edited_test ?? sample.suggested_test;
  // Once a run exists, show the snapshot it was approved with (survives reload).
  const test = run?.test ?? savedTest;
  const [draft, setDraft] = useState<SuggestedTest>(sample.suggested_test);
  const edited = JSON.stringify(test) !== JSON.stringify(sample.suggested_test);
  const state = decisionState({
    review_status: decision.review_status,
    decision: decision.decision,
    route: sample.route,
  });
  const frames = (scout: StoryboardFrame["scout"]) =>
    sample.storyboard.filter((frame) => frame.scout === scout);
  const variant = frames("variant");

  return (
    <Shell section="Insight review">
      <Link className="back-link" to="/insights" search={backSearch}>
        <ArrowLeft size={14} />
        Insights
      </Link>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <SourceMarker source={sample.source} />
          <VideoCount count={sample.video_count} illustrative />
          <SimulatedBadge size="md" detail={SAMPLE_NOTE} />
          <span className="text-[11px] text-muted-foreground">{sample.category}</span>
          <span
            className={`status-badge ml-auto ${state.tone === "done" ? "reviewed" : ""} ${state.tone === "muted" ? "opacity-70" : ""}`}
          >
            {state.text}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-[#f5effb]">{sample.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sample.summary}</p>
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {sample.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[#ffffff1a] bg-[#ffffff06] px-3 py-2"
            >
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {stat.label} <span className="normal-case">· sample</span>
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="grid min-w-0 gap-4">
          <EvidenceBlock
            scoutId="tracker"
            heading="Tracker · your users"
            sourceLabel={sample.observations.tracker.source_label}
            text={sample.observations.tracker.text}
            frames={frames("tracker")}
          />
          <EvidenceBlock
            scoutId="explorer"
            heading={`Explorer · ${sample.competitor}`}
            sourceLabel={sample.observations.explorer.source_label}
            text={sample.observations.explorer.text}
            frames={frames("explorer")}
          />
          <p className="text-[11px] text-muted-foreground">{sample.storyboard_note}</p>
        </div>

        <section
          aria-label="Suggested test"
          className="rounded-xl border p-4"
          style={{ borderColor: experimenter.colors.ring, background: experimenter.colors.tint }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="section-kicker">Suggested A/B test</span>
            <RouteBadge route="experiment" />
          </div>
          {variant.length > 0 && (
            <div className="mt-3 flex justify-center">
              {variant.map((frame) => (
                <StoryboardCard key={frame.id} frame={frame} />
              ))}
            </div>
          )}
          {editing ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const same = JSON.stringify(draft) === JSON.stringify(sample.suggested_test);
                simulation.saveSampleDraft(same ? undefined : draft);
                setEditing(false);
              }}
            >
              {editable.map((field) => (
                <label className="field" key={field.key}>
                  {field.label}
                  {field.multiline ? (
                    <textarea
                      rows={3}
                      maxLength={600}
                      value={draft[field.key] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      maxLength={120}
                      value={draft[field.key] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" type="submit">
                  <Check size={14} />
                  Save edits
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <dl className="mt-3 grid gap-3 text-xs">
              <Field name="Change">{test.change}</Field>
              <Field name="Traffic">{sample.traffic_percent}% of users see the variant</Field>
              <Field name="Primary metric">{test.primary_metric}</Field>
              {test.guardrail_metric && <Field name="Guardrail">{test.guardrail_metric}</Field>}
              <Field name="Hypothesis">{test.hypothesis}</Field>
              {edited && (
                <p className="text-[11px] text-muted-foreground">
                  Edited by you. The sample PR, diffs and analytics stay fixed.
                </p>
              )}
            </dl>
          )}

          {!editing && decision.decision === "pending" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() =>
                  experimenterOff
                    ? simulation.approveSampleOnly(edited ? test : undefined)
                    : simulation.approveSample(edited ? test : undefined)
                }
              >
                <Check size={14} />
                Approve test
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft(test);
                  setEditing(true);
                }}
              >
                <PencilLine size={14} />
                Edit test
              </Button>
              <Button size="sm" variant="outline" onClick={() => simulation.rejectSample()}>
                <X size={14} />
                Reject test
              </Button>
            </div>
          )}

          {decision.decision === "approved" && !run && experimenterOff && (
            <p className="mt-4 text-xs text-muted-foreground" role="status">
              Experimenter is off in Settings. Approval saved, no run started.
            </p>
          )}
          {decision.decision === "approved" && !run && !experimenterOff && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => simulation.approveSample(edited ? test : undefined)}>
                <Play size={14} />
                Start test
              </Button>
              <span className="text-xs text-muted-foreground">Approved · not started</span>
            </div>
          )}
          {decision.decision === "approved" && run && run.pr.status === "merged" && (
            <div
              className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/60 p-3 text-xs"
              role="status"
            >
              <SimulatedBadge />
              <span className="flex-1 text-muted-foreground">Experimenter · PR merged</span>
              <Link
                to="/rollouts"
                search={{ pr: run.id }}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                View in Rollouts
                <ArrowRight size={13} />
              </Link>
            </div>
          )}
          {decision.decision === "approved" && run && stage && run.pr.status !== "merged" && (
            <div
              className="mt-4 rounded-md border border-border bg-card/60 p-3 text-xs"
              role="status"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SimulatedBadge />
                <span className="flex-1 text-muted-foreground">Experimenter · {stage.label}</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ffffff14]"
                role="progressbar"
                aria-label="Simulated run progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stage.progress * 100)}
              >
                <span
                  className="block h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.round(stage.progress * 100)}%`,
                    background: experimenter.colors.main,
                  }}
                />
              </div>
              <Link
                to="/ab-tests"
                search={{ run: run.id }}
                className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Follow it in A/B Tests
                <ArrowRight size={13} />
              </Link>
            </div>
          )}
          {decision.decision !== "pending" && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => simulation.resetSample()}
            >
              <RotateCcw size={14} />
              Return to pending
            </Button>
          )}
          <p className="draft-boundary">Simulated in this browser. Nothing is deployed.</p>
        </section>
      </div>
    </Shell>
  );
}
