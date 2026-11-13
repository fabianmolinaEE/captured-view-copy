import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { connectionStatus } from "@/lib/research/apiClient";
import { syncSession, deleteShared } from "@/lib/research/sharedStorage";
import { saveSession } from "@/lib/research/sessionStorage";
import type { Session } from "@/lib/research/types";
/** Upload is always a researcher action, including for historical local recordings. */
export function SharedSessionPanel({
  session,
  onSynced,
  onError,
}: {
  session: Session;
  onSynced: (session: Session) => void;
  onError: (error: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    connectionStatus()
      .then((s) => setEnabled(s.backend_configured))
      .catch(() => {});
  }, []);
  const run = async (fn: () => Promise<void>) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Shared storage failed.");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="finding">
      <h3>
        Storage:{" "}
        {session.sync?.state === "synced"
          ? "Shared copy saved"
          : session.sync
            ? "Local changes to shared session"
            : "Local only"}
      </h3>
      <p>
        {enabled
          ? "Shared copies use private storage. Updates are explicit and check for conflicting team edits."
          : "Shared backend is not configured. Local recording and review remain available."}
      </p>
      {enabled && (
        <>
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I approve uploading this full recording and research document to the team’s private
            storage. The full video may include researcher setup.
          </label>
          <Button
            variant="outline"
            disabled={!consent || busy}
            onClick={() => void run(async () => onSynced(await syncSession(session)))}
          >
            Save shared copy
          </Button>
          {session.sync && (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Delete the shared copy? Local recording will remain."))
                  void run(async () => {
                    await deleteShared(session.id);
                    const { sync: _sync, ...local } = session;
                    await saveSession(local);
                    onSynced(local);
                  });
              }}
            >
              Delete shared copy
            </Button>
          )}
        </>
      )}
    </div>
  );
}
