import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, PencilLine, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";
import { scoutForRoute } from "@/lib/research/scouts";
import {
  acceptAndApprove,
  approvalBlocker,
  approveTest,
  editTest,
  effectiveRoute,
  effectiveTest,
  rejectTest,
  resetTest,
  revertTestEdits,
  setRoute,
  testDecisionOf,
  testSourceLabel,
} from "@/lib/research/testDecisions";
import { ideaSourceFor, runsForFinding, type SimulatedRun } from "@/lib/research/simulation";
import { useSimulation } from "@/hooks/use-simulation";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import type { ProductId } from "@/lib/research/products";
import {
  suggestedRouteLabels,
  type Finding,
  type Session,
  type SuggestedRoute,
  type SuggestedTest,
} from "@/lib/research/types";

type Update = (change: (session: Session) => Session) => Promise<boolean>;

/** Fix → Fixer (orange), Experiment → Experimenter (purple). */
export function RouteBadge({ route, chosen = false }: { route: SuggestedRoute; chosen?: boolean }) {
  const scout = scoutForRoute(route);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        color: scout.colors.main,
        borderColor: scout.colors.ring,
        background: scout.colors.tint,
      }}
      title={chosen ? "Route chosen by the reviewer" : "Route suggested by the agent"}
    >
      <ScoutMascot scout={scout} size={16} decorative halo={false} />
      {route === "fix" ? "Fix" : "Experiment"} → {scout.name}
    </span>
  );
}

const decisionText = (route: SuggestedRoute, decision: "pending" | "approved" | "rejected") => {
  const noun = route === "fix" ? "Fix" : "Test";
  return decision === "pending"
    ? `${noun} awaiting decision`
    : decision === "approved"
      ? `${noun} approved`
      : `${noun} rejected`;
};
export function TestDecisionBadge({ finding }: { finding: Finding }) {
  const decision = testDecisionOf(finding);
  return (
    <span
      className={`status-badge ${decision === "approved" ? "reviewed" : ""} ${decision === "rejected" ? "opacity-70" : ""}`}
    >
      {decisionText(effectiveRoute(finding), decision)}
    </span>
  );
}

/** One-line card summary: route badge, the test/fix in effect and its decision. */
export function TestSummary({ finding }: { finding: Finding }) {
  const route = effectiveRoute(finding);
  const test = effectiveTest(finding);
  const source = testSourceLabel(finding);
  const text =
    route === "fix" ? (test?.change ?? finding.recommendation) : (test?.hypothesis ?? test?.change);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <RouteBadge route={route} chosen={!!finding.test_decision?.route_override} />
      {text ? (
        // Clamped rather than truncated: a `title` tooltip would sit under the card's stretched
        // link and never show, and the full text is on the insight detail page.
        <span className="line-clamp-2 min-w-0 max-w-full flex-1 basis-60">
          {source ? `${source}: ` : route === "fix" ? "From the recommendation: " : ""}
          {text}
        </span>
      ) : (
        <span className="flex-1">No test suggested yet</span>
      )}
      <TestDecisionBadge finding={finding} />
    </div>
  );
}

const emptyTest: SuggestedTest = { hypothesis: "", change: "", primary_metric: "" };
const fields: {
  key: keyof SuggestedTest;
  label: string;
  fixLabel: string;
  max: number;
  multiline?: boolean;
  optional?: boolean;
}[] = [
  {
    key: "hypothesis",
    label: "Hypothesis",
    fixLabel: "Expected outcome",
    max: 600,
    multiline: true,
  },
  { key: "change", label: "Variant change", fixLabel: "The fix", max: 600, multiline: true },
  { key: "primary_metric", label: "Primary metric", fixLabel: "How we'll check it", max: 120 },
  {
    key: "guardrail_metric",
    label: "Guardrail metric",
    fixLabel: "Guardrail",
    max: 120,
    optional: true,
  },
  {
    key: "target_screen",
    label: "Target screen",
    fixLabel: "Target screen",
    max: 200,
    optional: true,
  },
];

function RunLink({ run, stage }: { run: SimulatedRun; stage: string }) {
  const fix = run.kind === "fix";
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/60 p-3 text-xs"
      role="status"
    >
      <SimulatedBadge detail="Client-side simulation. No experiment, repository write or deployment happens." />
      <span className="flex-1 text-muted-foreground">
        {fix ? "Fixer" : "Experimenter"} · {stage}
      </span>
      <Link
        to={fix ? "/rollouts" : "/ab-tests"}
        search={(fix ? { pr: run.id } : { run: run.id }) as never}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        {fix ? "See the fix in Rollouts" : "Follow it in A/B Tests"}
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}

/**
 * Human decision on the agent's suggested test (AUTOMATED-LOOP §4.1). The model's
 * suggested_test is never edited here: edits go to test_decision.edited_test. Approval only
 * starts a labeled client-side simulated run.
 */
export function SuggestedTestPanel({
  finding,
  update,
  productId,
}: {
  finding: Finding;
  update: Update;
  productId: ProductId | null;
}) {
  const simulation = useSimulation();
  const { settings: agentSettings } = useAgentSettings();
  const route = effectiveRoute(finding);
  const test = effectiveTest(finding);
  const source = testSourceLabel(finding);
  const decision = testDecisionOf(finding);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SuggestedTest>(emptyTest);
  const [error, setError] = useState("");
  const blocker = approvalBlocker(finding);
  const acceptBlocker = approvalBlocker(finding, { assumeAccepted: true });
  // While the insight is pending, the combined "Accept insight & approve" action covers acceptance,
  // so only a missing test/fix field is worth explaining.
  const pendingBlocker = finding.review_status === "accepted" ? blocker : acceptBlocker;
  const noun = route === "fix" ? "fix" : "test";
  const runs = runsForFinding(simulation.runs, finding.id).filter(
    (run) => run.pr.status !== "closed",
  );
  const run = runs.at(-1);
  const routeScout = scoutForRoute(route);
  const scoutOff = !agentSettings[routeScout.id].enabled;
  const scoutOffNote = `${routeScout.name} is turned off in Settings → Scouts. Approval saved, no run started.`;

  /** Applies a decision change, withdrawing simulated runs when an approval is withdrawn. */
  const apply = async (change: (session: Session) => Session) => {
    setError("");
    const wasApproved = decision === "approved";
    let next: Session | undefined;
    const saved = await update((session) => (next = change(session)));
    if (!saved) return undefined;
    const updated = next?.findings.find((f) => f.id === finding.id);
    if (!updated) return undefined;
    if (wasApproved && testDecisionOf(updated) !== "approved")
      simulation.discardForFinding(finding.id);
    return updated;
  };
  const approve = async (change: (session: Session) => Session) => {
    let owner: Session | undefined;
    const updated = await apply((session) => (owner = change(session)));
    if (!updated || testDecisionOf(updated) !== "approved") return;
    if (!agentSettings[scoutForRoute(effectiveRoute(updated)).id].enabled) return;
    try {
      simulation.start(updated, effectiveRoute(updated), {
        product_id: productId,
        idea_source: owner ? ideaSourceFor(owner) : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The simulated run could not start.");
    }
  };
  const startEdit = () => {
    setDraft({
      ...emptyTest,
      ...(test ?? {}),
      ...(!test && route === "fix" && finding.recommendation
        ? { change: finding.recommendation }
        : {}),
    });
    setEditing(true);
  };
  const saveEdit = async () => {
    const clean: SuggestedTest = {
      hypothesis: draft.hypothesis,
      change: draft.change,
      primary_metric: draft.primary_metric,
      ...(draft.guardrail_metric?.trim() ? { guardrail_metric: draft.guardrail_metric } : {}),
      ...(draft.target_screen?.trim() ? { target_screen: draft.target_screen } : {}),
    };
    await apply((s) => editTest(s, finding.id, clean));
    setEditing(false);
  };

  return (
    <section className="next-step-panel" aria-label="Suggested test">
      <div className="next-step-heading">
        <span className="section-kicker">
          <ScoutMascot scout={scoutForRoute(route)} size={20} decorative halo={false} />
          Suggested {route === "fix" ? "fix" : "A/B test"}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {source && <span className="status-badge">{source}</span>}
          <TestDecisionBadge finding={finding} />
        </span>
      </div>
      <h2>
        {route === "fix" ? "Clear problem? Send it to the Fixer." : "Open question? Test it."}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Route">
        {(["fix", "experiment"] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={route === option ? "default" : "outline"}
            aria-pressed={route === option}
            onClick={() => void apply((s) => setRoute(s, finding.id, option))}
          >
            <ScoutMascot scout={scoutForRoute(option)} size={16} decorative halo={false} />
            {suggestedRouteLabels[option]}
          </Button>
        ))}
        {finding.suggested_route &&
          finding.test_decision?.route_override &&
          finding.test_decision.route_override !== finding.suggested_route && (
            <span className="text-[11px] text-muted-foreground">
              Agent suggested: {suggestedRouteLabels[finding.suggested_route]}
            </span>
          )}
      </div>

      {editing ? (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit();
          }}
        >
          {fields.map((field) => (
            <label className="field" key={field.key}>
              {route === "fix" ? field.fixLabel : field.label}
              {field.optional ? " (optional)" : ""}
              {field.multiline ? (
                <textarea
                  rows={3}
                  maxLength={field.max}
                  value={draft[field.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                />
              ) : (
                <input
                  maxLength={field.max}
                  value={draft[field.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Describe the metric in words, with no predicted numbers.
          </p>
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
      ) : test || (route === "fix" && finding.recommendation) ? (
        <dl className="mt-4 grid gap-3 text-xs">
          {fields.map((field) => {
            const value =
              test?.[field.key] ??
              (field.key === "change" && route === "fix" ? finding.recommendation : undefined);
            if (!value?.trim()) return null;
            return (
              <div key={field.key}>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {route === "fix" ? field.fixLabel : field.label}
                </dt>
                <dd className="mt-1 leading-relaxed">{value}</dd>
              </div>
            );
          })}
          {!test && (
            <p className="text-[11px] text-muted-foreground">From the insight's recommendation.</p>
          )}
        </dl>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          No test suggested. Write one to approve it.
        </p>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {finding.review_status !== "accepted" && (
            <Button
              size="sm"
              disabled={!!acceptBlocker || finding.review_status === "rejected"}
              onClick={() => void approve((s) => acceptAndApprove(s, finding.id))}
            >
              <Check size={14} />
              Accept insight &amp; approve {noun}
            </Button>
          )}
          <Button
            size="sm"
            variant={finding.review_status === "accepted" ? "default" : "outline"}
            disabled={!!blocker || decision === "approved"}
            onClick={() => void approve((s) => approveTest(s, finding.id))}
          >
            <Check size={14} />
            Approve {noun}
          </Button>
          <Button size="sm" variant="outline" onClick={startEdit}>
            <PencilLine size={14} />
            Edit {noun}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={decision === "rejected"}
            onClick={() => void apply((s) => rejectTest(s, finding.id))}
          >
            <X size={14} />
            Reject {noun}
          </Button>
          {decision !== "pending" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void apply((s) => resetTest(s, finding.id))}
            >
              Return to pending
            </Button>
          )}
          {source === "Edited by reviewer" && finding.suggested_test && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void apply((s) => revertTestEdits(s, finding.id))}
            >
              <RotateCcw size={14} />
              Revert to agent suggestion
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="error-note mt-3" role="alert">
          {error}
        </p>
      )}
      {decision === "approved" && run && (
        <RunLink run={run} stage={simulation.stageOf(run).label} />
      )}
      {decision === "approved" && !run && scoutOff && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {scoutOffNote}
        </p>
      )}
      <p className="draft-boundary">
        {finding.review_status === "rejected"
          ? `Reopen the insight to approve a ${noun}. `
          : decision !== "approved" && pendingBlocker
            ? `${pendingBlocker} `
            : ""}
        Simulated in this browser. Nothing is deployed.
      </p>
    </section>
  );
}
