import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeSession, connectionStatus, type ConnectionStatus } from "@/lib/research/apiClient";
import type { Session, AnalysisMode, AnalysisRun, Finding } from "@/lib/research/types";

/** Presentation boundary: the pipeline returns immutable runs; the parent persists them. */
export function AnalysisPanel({
  session,
  onResult,
  onError,
}: {
  session: Session;
  onResult: (run: AnalysisRun, findings: Finding[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [connection, setConnection] = useState<ConnectionStatus>();
  const [mode, setMode] = useState<AnalysisMode>("video_frames_plus_events");
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    connectionStatus()
      .then(setConnection)
      .catch((e) => onError(e.message));
  }, [onError]);
  const start = async () => {
    if (busy.current || !consent) return;
    busy.current = true;
    onError("");
    const started_at = new Date().toISOString();
    try {
      const result = await analyzeSession(session, mode, setProgress);
      await onResult(result.run, result.findings);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      onError(message);
      await onResult(
        {
          id: crypto.randomUUID(),
          mode,
          model_name: connection?.model ?? "unknown",
          status: "failed",
          started_at,
          completed_at: new Date().toISOString(),
          error: message,
        },
        [],
      );
    } finally {
      busy.current = false;
      setProgress("");
    }
  };
  return (
    <div className="my-4 space-y-3">
      <div className="info-note">{connection?.message ?? "Checking secure AI connection…"}</div>
      <label className="field">
        Analysis input
        <select
          disabled={!!progress}
          value={mode}
          onChange={(e) => setMode(e.target.value as AnalysisMode)}
        >
          <option value="video_frames_plus_events">Checkout video frames + events</option>
          <option value="events_only">Events-only baseline (no images)</option>
        </select>
      </label>
      <label className="flex gap-2 text-xs">
        <input
          type="checkbox"
          checked={consent}
          disabled={!!progress}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I approve sending this session’s{" "}
        {mode === "events_only" ? "events" : "checkout frames and events"} to Google for analysis. I
        checked for sensitive information.
      </label>
      <Button
        className="w-full"
        disabled={!connection?.configured || !consent || !!progress}
        onClick={() => void start()}
      >
        {progress || "Analyze with AI"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Proposals require human review. Sampled frames can miss short failures. Cost unavailable;
        reported API token usage appears with each run.
      </p>
    </div>
  );
}
