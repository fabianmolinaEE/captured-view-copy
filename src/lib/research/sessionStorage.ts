import { defaultSampling, type Session, type SamplingSettings } from "./types";
const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    // Preserve the historical database ID so rebranding keeps existing recordings accessible.
    const request = indexedDB.open("zero-to-hero", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("sessions", { keyPath: "id" });
      request.result.createObjectStore("settings");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error("Browser storage could not be opened. Check that local storage is permitted."),
      );
  });
async function request<T>(
  store: string,
  mode: IDBTransactionMode,
  operation: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = operation(tx.objectStore(store));
    tx.oncomplete = () => {
      db.close();
      resolve(result.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Unable to save local data. Your browser may have run out of storage."));
    };
    tx.onabort = () => {
      db.close();
      reject(new Error("Local storage operation was interrupted."));
    };
  });
}
export const listSessions = async () =>
  (await request<Session[]>("sessions", "readonly", (s) => s.getAll())).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
export const getSession = (id: string) =>
  request<Session | undefined>("sessions", "readonly", (s) => s.get(id));
export const saveSession = (session: Session) =>
  request("sessions", "readwrite", (s) => s.put(session));
export const deleteSession = (id: string) => request("sessions", "readwrite", (s) => s.delete(id));
export const clearAll = async () => {
  await request("sessions", "readwrite", (s) => s.clear());
  await request("settings", "readwrite", (s) => s.clear());
};
export const getSampling = async (): Promise<SamplingSettings> =>
  (await request<SamplingSettings | undefined>("settings", "readonly", (s) => s.get("sampling"))) ??
  defaultSampling;
export const saveSampling = (settings: SamplingSettings) =>
  request("settings", "readwrite", (s) => s.put(settings, "sampling"));
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportSession(session: Session) {
  const { video_blob: _video, ...data } = session;
  downloadFile(
    new Blob(
      [
        JSON.stringify(
          {
            ...data,
            export_version: 1,
            video_filename:
              session.public_video && !session.video_blob.size
                ? null
                : `loopmate-${session.id}.${session.extension}`,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    `loopmate-${session.id}.json`,
  );
}
