import type { Session, ActionDraft } from "./types";

/** Draft approval records research intent only. There is no execution side effect. */
export function updateActionDraft(
  session: Session,
  findingId: string,
  patch: Partial<Pick<ActionDraft, "title" | "scope" | "status">>,
): Session {
  const finding = session.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error("This finding is no longer available.");
  const previous = finding.next_step;
  const edited =
    (patch.title !== undefined && patch.title !== previous?.title) ||
    (patch.scope !== undefined && patch.scope !== previous?.scope);
  const next: ActionDraft = {
    title: previous?.title ?? "",
    scope: previous?.scope ?? "",
    status: previous?.status ?? "draft",
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (edited) next.status = "draft";
  if (
    next.status === "approved" &&
    (!next.title.trim() || !next.scope.trim() || finding.review_status !== "accepted")
  )
    throw new Error("Accept the finding and add a title and scope before approving a draft.");
  return {
    ...session,
    findings: session.findings.map((f) => (f.id === findingId ? { ...f, next_step: next } : f)),
  };
}
