import { PencilLine } from "lucide-react";
import type { Finding } from "@/lib/research/types";

/**
 * Legacy researcher next-step drafts (AUTOMATED-LOOP §4.2), shown read-only as
 * "Earlier research draft". New UI does not create them and they never reach the model.
 */
export function NextStepDraft({ finding }: { finding: Finding }) {
  const draft = finding.next_step;
  if (!draft || (!draft.title.trim() && !draft.scope.trim())) return null;
  return (
    <section className="next-step-panel" aria-label="Earlier research draft">
      <div className="next-step-heading">
        <span className="section-kicker">
          <PencilLine size={14} />
          Earlier research draft
        </span>
        <span className="status-badge">
          {draft.status === "approved"
            ? "Draft approved"
            : draft.status === "dismissed"
              ? "Draft dismissed"
              : "Draft"}
        </span>
      </div>
      {draft.title.trim() && <h2>{draft.title}</h2>}
      {draft.scope.trim() && (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {draft.scope}
        </p>
      )}
      <p className="draft-boundary">
        Read only. Written by a researcher before suggested tests existed. It is kept for reference,
        is never sent to the model and does not start anything.
      </p>
    </section>
  );
}
