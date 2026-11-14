import { isPublicVideo } from "@/lib/research/publicVideo";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  AnalysisNotSentError,
  analysisOptionsFor,
  analyzeSession,
  checkUsageCap,
  connectionStatus,
  type ConnectionStatus,
} from "@/lib/research/apiClient";
import { scoutForSession } from "@/lib/research/agentSettings";
import { competitorProductOf } from "@/lib/research/competitors";
import { productNameForSource, products } from "@/lib/research/products";
import { getScout } from "@/lib/research/scouts";
import { listSessions } from "@/lib/research/sessionStorage";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import {
  agentFocusLabels,
  type Session,
  type AnalysisMode,
  type AnalysisRun,
  type Finding,
} from "@/lib/research/types";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { ScoutMascot } from "./ScoutMascot";

/**
 * Presentation boundary: the pipeline returns immutable runs; the parent persists them.
 * Framed as sending out the scout that analyzes this footage: Tracker for your own product,
 * Explorer for competitor footage. Focus areas and the daily cap come from Settings → Scouts.
 */
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
  const publicVideo = isPublicVideo(session);
  const [mode, setMode] = useState<AnalysisMode>(
    publicVideo ? "public_video" : "video_frames_plus_events",
  );
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState("");
  const [stored, setStored] = useState<Session[]>();
  const busy = useRef(false);
  const { settings } = useAgentSettings();
  const scoutId = scoutForSession(session);
  const scout = getScout(scoutId);
  const competitorOf = competitorProductOf(session);
  useEffect(() => {
    connectionStatus()
      .then(setConnection)
      .catch((e) => onError(e.message));
  }, [onError]);
  // Re-read stored runs whenever this session's runs change, so the cap counts the run just saved.
  const runCount = session.runs.length;
  useEffect(() => {
    let live = true;
    listSessions()
      .then((all) => live && setStored(all))
      .catch(() => live && setStored([]));
    return () => {
      live = false;
    };
  }, [runCount]);
  useSessionsChanged(() => {
    listSessions()
      .then(setStored)
      .catch(() => {});
  });
  const usage = useMemo(() => {
    if (!stored) return undefined;
    // The prop is the freshest copy of this session; stored copies may lag one save behind.
    const all = [...stored.filter((item) => item.id !== session.id), session];
    return checkUsageCap(session, all, settings);
  }, [stored, session, settings]);
  const focus = settings[scoutId].focus_areas;
  const start = async () => {
    if (busy.current || !consent || !usage || usage.blocked) return;
    busy.current = true;
    onError("");
    const started_at = new Date().toISOString();
    try {
      const result = await analyzeSession(session, mode, setProgress, {
        ...analysisOptionsFor(session, settings),
        usage,
      });
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
          reached_provider: !(error instanceof AnalysisNotSentError),
        },
        [],
      );
    } finally {
      busy.current = false;
      setProgress("");
    }
  };
  const blocked = !!usage?.blocked;
  return (
    <div className="my-4 space-y-3">
      <div className="flex items-start gap-3">
        <ScoutMascot scout={scoutId} size={40} decorative />
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: scout.colors.main }}>
            Send out {scout.name}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {competitorOf
              ? `Competitor patterns to adopt or avoid in ${products.find((product) => product.id === competitorOf)?.name ?? "your product"}.`
              : `Finds where users struggle in ${productNameForSource(session.source_app)}.`}
          </p>
        </div>
      </div>
      <div className="info-note">{connection?.message ?? "Checking secure AI connection…"}</div>
      <label className="field">
        Analysis input
        <select
          disabled={!!progress}
          value={mode}
          onChange={(e) => setMode(e.target.value as AnalysisMode)}
        >
          {publicVideo ? (
            <option value="public_video">Video recording</option>
          ) : (
            <>
              <option value="video_frames_plus_events">Video + interactions</option>
              <option value="events_only">Events-only baseline (no images)</option>
            </>
          )}
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground" data-testid="scout-focus">
        Focus areas:{" "}
        {focus.length ? focus.map((area) => agentFocusLabels[area]).join(", ") : "all lenses"}.{" "}
        <Link to="/settings" hash="scouts" className="underline">
          Tune {scout.name}
        </Link>
      </p>
      <p className="text-[11px] text-muted-foreground" role="status">
        {usage
          ? `Today: ${usage.used} of ${usage.max} ${usage.max === 1 ? "analysis" : "analyses"} used by ${scout.name}.`
          : "Checking today's usage…"}
      </p>
      {blocked && (
        <div className="error-note" role="alert">
          {usage?.reason}
        </div>
      )}
      <label className="flex gap-2 text-xs">
        <input
          type="checkbox"
          checked={consent}
          disabled={!!progress}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I approve sending this session’s{" "}
        {mode === "public_video"
          ? "selected video segment"
          : mode === "events_only"
            ? "events"
            : "video frames and interactions"}{" "}
        to Google for analysis. I checked for sensitive information.
      </label>
      <Button
        className="w-full"
        disabled={!connection?.configured || !consent || !!progress || !usage || blocked}
        onClick={() => void start()}
      >
        {progress || `Send out ${scout.name}`}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        You review every insight before anything changes. No runner yet, so analyses start here.
        Cost unavailable; tokens shown per run.
      </p>
    </div>
  );
}
