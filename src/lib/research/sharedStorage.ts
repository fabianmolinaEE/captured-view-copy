import { researchFetch } from "./apiClient";
import { saveSession } from "./sessionStorage";
import type { Session } from "./types";
export interface SharedSummary {
  id: string;
  title: string;
  created_at: string;
}
export async function syncSession(session: Session): Promise<Session> {
  const { video_blob, sync: _sync, ...document } = session;
  const form = new FormData();
  form.set("document", JSON.stringify(document));
  form.set("video", video_blob, "recording");
  const result = (await (
    await researchFetch(`sessions/${session.id}`, {
      method: "PUT",
      headers: session.sync ? { "If-Match": session.sync.synced_at } : {},
      body: form,
    })
  ).json()) as { synced_at: string };
  const synced: Session = { ...session, sync: { state: "synced", synced_at: result.synced_at } };
  await saveSession(synced);
  return synced;
}
export async function listShared(): Promise<SharedSummary[]> {
  return (await researchFetch("sessions")).json();
}
export async function fetchShared(id: string): Promise<Session> {
  const form = await (await researchFetch(`sessions/${id}`)).formData();
  const raw = form.get("document");
  const video = form.get("video");
  if (typeof raw !== "string" || !(video instanceof Blob))
    throw new Error("Shared session response is incomplete.");
  const data = JSON.parse(raw) as Session;
  if (data.id !== id || !Array.isArray(data.events) || !Array.isArray(data.findings))
    throw new Error("Shared document is invalid.");
  const synced = { ...data, video_blob: video };
  await saveSession(synced);
  return synced;
}
export const deleteShared = async (id: string) => {
  await researchFetch(`sessions/${id}`, { method: "DELETE" });
};
