import { Check, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateActionDraft } from "@/lib/research/actions";
import type { Finding, Session } from "@/lib/research/types";

export function NextStepDraft({
  finding,
  update,
}: {
  finding: Finding;
  update: (change: (session: Session) => Session) => Promise<boolean>;
}) {
  const draft = finding.next_step;
  const patch = (changes: Parameters<typeof updateActionDraft>[2]) =>
    void update((session) => updateActionDraft(session, finding.id, changes));
  const eligible =
    finding.review_status === "accepted" && !!draft?.title.trim() && !!draft.scope.trim();
  return (
    <section className="next-step-panel" aria-label="Suggested next step">
      <div className="next-step-heading">
        <span className="section-kicker">
          <PencilLine size={14} />
          Suggested next step
        </span>
        <span className={`status-badge ${draft?.status === "approved" ? "reviewed" : ""}`}>
          {draft?.status === "approved"
            ? "Draft approved"
            : draft?.status === "dismissed"
              ? "Draft dismissed"
              : "Researcher draft"}
        </span>
      </div>
      <h2>What would you like to improve?</h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Write your interpretation and the change you want to explore. This stays separate from the
        model’s original finding.
      </p>
      <label className="field">
        Next-step title
        <input
          value={draft?.title ?? ""}
          maxLength={160}
          placeholder="Name the improvement you want to explore"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>
      <label className="field">
        Proposed scope
        <textarea
          rows={4}
          maxLength={4000}
          value={draft?.scope ?? ""}
          placeholder="Describe what should change, where, and what you would check."
          onChange={(e) => patch({ scope: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!eligible || draft?.status === "approved"}
          onClick={() => patch({ status: "approved" })}
        >
          <Check size={14} />
          Approve draft
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!draft || draft.status === "dismissed"}
          onClick={() => patch({ status: "dismissed" })}
        >
          <X size={14} />
          Dismiss draft
        </Button>
        {draft && draft.status !== "draft" && (
          <Button size="sm" variant="ghost" onClick={() => patch({ status: "draft" })}>
            Return to draft
          </Button>
        )}
      </div>
      <p className="draft-boundary">
        {finding.review_status !== "accepted"
          ? "Accept the finding before approving its next-step draft. "
          : ""}
        Approval saves a research decision only. No experiment, code change, or release is started.
        Editing an approved draft returns it to draft.
      </p>
    </section>
  );
}
