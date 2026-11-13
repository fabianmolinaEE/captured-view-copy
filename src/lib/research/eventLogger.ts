import type { SessionEvent } from "./types";
/** Values are semantic flags only. Raw form content, credentials and arbitrary text are discarded. */
export function safeMetadata(metadata: SessionEvent["metadata"]) {
  if (!metadata) return undefined;
  const safe: NonNullable<SessionEvent["metadata"]> = {};
  for (const key of ["hit", "valid", "changed"])
    if (typeof metadata[key] === "boolean") safe[key] = metadata[key];
  if (typeof metadata["scroll_top"] === "number" && Number.isFinite(metadata["scroll_top"]))
    safe["scroll_top"] = metadata["scroll_top"];
  if (metadata["coordinate_space"] === "checkout_normalized")
    safe["coordinate_space"] = "checkout_normalized";
  if (metadata["source"] === "local_simulated_backend") safe["source"] = "local_simulated_backend";
  if (["postal_code", "contact_name", "address"].includes(String(metadata["field_id"])))
    safe["field_id"] = String(metadata["field_id"]);
  return Object.keys(safe).length ? safe : undefined;
}
export class EventLogger {
  events: SessionEvent[] = [];
  private active = false;
  private anchor = 0;
  private sessionId = "";
  start(sessionId: string, anchor: number) {
    this.events = [];
    this.sessionId = sessionId;
    this.anchor = anchor;
    this.active = true;
  }
  stop() {
    this.active = false;
    return [...this.events].sort((a, b) => a.t_ms - b.t_ms);
  }
  log(
    type: string,
    screen: string,
    details: Omit<Partial<SessionEvent>, "id" | "session_id" | "t_ms" | "type" | "screen"> = {},
  ) {
    if (!this.active) return;
    const { metadata, ...semantic } = details;
    this.events.push({
      ...semantic,
      id: crypto.randomUUID(),
      session_id: this.sessionId,
      t_ms: Math.max(0, Math.round(performance.now() - this.anchor)),
      type,
      screen,
      metadata: safeMetadata(metadata),
    });
  }
}
