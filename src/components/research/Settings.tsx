import { useEffect, useState } from "react";
import { Check, CircleAlert, HardDrive, ShieldCheck, Trash2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, PageHeading } from "./Shell";
import { clearAll, getSampling, saveSampling } from "@/lib/research/sessionStorage";
import { captureSupport } from "@/lib/research/capture";
import { connectionStatus, saveAccessCode, type ConnectionStatus } from "@/lib/research/apiClient";
import {
  agentFocusAreas,
  agentFocusLabels,
  defaultSampling,
  type SamplingSettings,
  type Session,
} from "@/lib/research/types";
import { listSessions } from "@/lib/research/sessionStorage";
import { trackerRunsFile } from "@/lib/research/demo/importTrackerRuns";
import { explorerRunsFile, reimportAllDemoRuns } from "@/lib/research/demo/importExplorerRuns";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { Switch } from "@/components/ui/switch";
import { ScoutCard } from "./ScoutCard";
import { SimulatedBadge } from "./SimulatedBadge";
import { getScout, scoutIds, type ScoutId } from "@/lib/research/scouts";
import { useAgentSettings } from "@/hooks/use-agent-settings";
import { useSimulation } from "@/hooks/use-simulation";
import {
  MAX_ANALYSES_LIMIT,
  RUNNER_NOT_CONNECTED,
  cadenceLabels,
  cadences,
  usageCapStatus,
  usesFocusAreas,
  type AgentSettings,
  type Cadence,
  type ScoutSettings,
} from "@/lib/research/agentSettings";

/** Keeps a raw draft while typing, so clearing the field never saves a cap of 0. */
function DailyCapInput({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    if (raw.trim() === "") return;
    const next = Number(raw);
    if (Number.isFinite(next)) onChange(next);
  };
  return (
    <input
      type="number"
      min={0}
      max={MAX_ANALYSES_LIMIT}
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function ScoutSettingsCard({
  id,
  value,
  sessions,
  settings,
  onChange,
}: {
  id: ScoutId;
  value: ScoutSettings;
  sessions: Session[] | undefined;
  settings: AgentSettings;
  onChange: (patch: Partial<ScoutSettings>) => void;
}) {
  const scout = getScout(id);
  const finds = usesFocusAreas(id);
  const usage = finds && sessions ? usageCapStatus(sessions, settings, id) : undefined;
  const switchId = `scout-${id}-enabled`;
  return (
    <ScoutCard scout={id} headingLevel={3} showStatusNote>
      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--scout-ring)] pt-3">
        <label htmlFor={switchId} className="text-sm font-medium">
          Send out {scout.name}
        </label>
        <Switch
          id={switchId}
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
      </div>
      {finds ? (
        <>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium">Focus areas</legend>
            <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
              {agentFocusAreas.map((area) => (
                <label key={area} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="accent-[color:var(--scout-main)]"
                    checked={value.focus_areas.includes(area)}
                    onChange={(e) =>
                      onChange({
                        focus_areas: e.target.checked
                          ? [...value.focus_areas, area]
                          : value.focus_areas.filter((item) => item !== area),
                      })
                    }
                  />
                  {agentFocusLabels[area]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-[color:var(--muted-foreground)]">
              Emphasis only. Other lenses stay on.
            </p>
          </fieldset>
          <label className="field">
            Minimum confidence to surface: {Math.round(value.min_confidence * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              className="accent-[color:var(--scout-main)]"
              value={Math.round(value.min_confidence * 100)}
              onChange={(e) => onChange({ min_confidence: Number(e.target.value) / 100 })}
            />
          </label>
          <p className="-mt-3 text-[11px] leading-snug text-[color:var(--muted-foreground)]">
            Lower scores are hidden, not deleted.
          </p>
          <label className="field">
            Max analyses per day
            <DailyCapInput
              value={value.max_analyses_per_day}
              onChange={(next) => onChange({ max_analyses_per_day: next })}
            />
          </label>
          <p className="-mt-3 text-[11px] leading-snug text-[color:var(--muted-foreground)]">
            {usage
              ? `Used today: ${usage.used} of ${usage.max} · Analyze stops at the cap.`
              : "Counting today's stored runs…"}
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-snug text-[color:var(--muted-foreground)]">
          Approved {id === "fixer" ? "fixes" : "tests"} start a labeled simulated run. Nothing is
          deployed.
        </p>
      )}
      <label className="field">
        Cadence
        <select
          value={value.cadence}
          onChange={(e) => onChange({ cadence: e.target.value as Cadence })}
        >
          {cadences.map((cadence) => (
            <option key={cadence} value={cadence}>
              {cadenceLabels[cadence]}
            </option>
          ))}
        </select>
      </label>
      <p className="-mt-3 text-[11px] leading-snug text-[color:var(--muted-foreground)]">
        {RUNNER_NOT_CONNECTED}. Saved, not scheduled.
      </p>
    </ScoutCard>
  );
}
export function Settings() {
  const [settings, setSettings] = useState<SamplingSettings>(defaultSampling);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [storage, setStorage] = useState<StorageEstimate>();
  const [connection, setConnection] = useState<ConnectionStatus>();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [simMessage, setSimMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const agents = useAgentSettings();
  const simulation = useSimulation();
  const [sessions, setSessions] = useState<Session[]>();
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
    connectionStatus()
      .then(setConnection)
      .catch((e) => setMessage(e.message));
    getSampling()
      .then(setSettings)
      .catch((e) => setMessage(e.message));
    setSupported(captureSupport());
    navigator.storage
      ?.estimate()
      .then(setStorage)
      .catch(() => {});
  }, []);
  useSessionsChanged(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  });
  return (
    <Shell section="Settings">
      <PageHeading
        title="Workspace settings"
        description="Scouts, AI connection, capture and storage for all products."
      />
      <section id="scouts" className="setting-section pt-0" aria-labelledby="scouts-settings">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="scouts-settings">Scouts</h2>
          <Button variant="ghost" size="sm" onClick={agents.reset}>
            Restore defaults
          </Button>
        </div>
        <p>Saved in this browser. Tracker and Explorer settings apply to real analyses.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {scoutIds.map((id) => (
            <ScoutSettingsCard
              key={id}
              id={id}
              value={agents.settings[id]}
              sessions={sessions}
              settings={agents.settings}
              onChange={(patch) => agents.updateScout(id, patch)}
            />
          ))}
        </div>
      </section>
      <section className="setting-section" aria-labelledby="simulated-settings">
        <h2 id="simulated-settings" className="flex flex-wrap items-center gap-2">
          Simulated demo data <SimulatedBadge />
        </h2>
        <p>
          Kept apart from research, never counted in it. {simulation.runs.length} simulated{" "}
          {simulation.runs.length === 1 ? "run" : "runs"} stored.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={!simulation.runs.length}
          onClick={() => {
            if (
              window.confirm(
                "Delete all simulated demo runs and PRs? Recordings, insights and reviews are not affected.",
              )
            ) {
              simulation.reset();
              setSimMessage(
                "Simulated demo data cleared. Research data was not changed. Approvals stay; restart from A/B Tests or Rollouts.",
              );
            }
          }}
        >
          <Trash2 />
          Reset simulated demo data
        </Button>
        {simMessage && (
          <div className="info-note mt-3" role="status">
            {simMessage}
          </div>
        )}
      </section>
      <section className="setting-section" aria-labelledby="tracker-runs-settings">
        <h2 id="tracker-runs-settings">Pre-generated runs</h2>
        <p>
          Real Gemini output: Tracker ({trackerRunsFile().model_name}) on{" "}
          {trackerRunsFile().videos.length} Uber Eats videos, Explorer (
          {explorerRunsFile().model_name}) on {explorerRunsFile().videos.length} DoorDash videos.
        </p>
        <p className="text-[11px] text-muted-foreground">
          Re-import adds only missing runs. Reviews are never overwritten. Not counted toward caps.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={importing}
          onClick={async () => {
            setImporting(true);
            setImportMessage("");
            try {
              setImportMessage((await reimportAllDemoRuns()).message);
              setSessions(await listSessions());
            } catch (e) {
              setImportMessage(e instanceof Error ? e.message : "Import failed.");
            } finally {
              setImporting(false);
            }
          }}
        >
          {importing ? "Importing…" : "Re-import Tracker and Explorer runs"}
        </Button>
        {importMessage && (
          <div className="info-note mt-3" role="status">
            {importMessage}
          </div>
        )}
      </section>
      <section className="setting-section">
        <div className="flex items-center justify-between">
          <h2>AI connection</h2>
          <span className="status-badge">
            {connection?.configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p>{connection?.message ?? "Checking server configuration…"}</p>
        <p>Model: {connection?.model ?? "Unknown"} · Cost unavailable · Keys stay on the server</p>
        <label className="field">
          Team workspace access code
          <input
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Provided by your team; never enter an API key"
          />
        </label>
        <Button
          variant="outline"
          onClick={() => {
            saveAccessCode(code);
            setCode("");
            setMessage("Workspace code saved for this browser tab.");
          }}
        >
          Save workspace code
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            saveAccessCode("");
            setMessage("Workspace access code cleared.");
          }}
        >
          Clear access code
        </Button>
        <p>
          Kept in this tab only. Shared storage:{" "}
          {connection?.backend_configured ? "configured" : "off, sessions stay local"}.
        </p>
      </section>
      <section className="setting-section">
        <h2>Video sampling</h2>
        <p>Used for real analysis. Scenarios and ground truth are never sent.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <label className="field">
            Interval (seconds)
            <select
              value={settings.interval_seconds}
              onChange={(e) =>
                setSettings({ ...settings, interval_seconds: Number(e.target.value) })
              }
            >
              <option value={1}>Every 1 second</option>
              <option value={2}>Every 2 seconds</option>
            </select>
          </label>
          <label className="field">
            Maximum frames
            <input
              type="number"
              min={4}
              max={40}
              value={settings.max_frames}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_frames: Math.min(40, Math.max(4, Number(e.target.value))),
                })
              }
            />
          </label>
          <label className="field">
            Maximum image width
            <select
              value={settings.max_width}
              onChange={(e) => setSettings({ ...settings, max_width: Number(e.target.value) })}
            >
              <option value={640}>640 px</option>
              <option value={960}>960 px</option>
            </select>
          </label>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await saveSampling(settings);
              setMessage("Sampling preferences saved.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Could not save preferences.");
            }
          }}
        >
          <Save />
          Save preferences
        </Button>
      </section>
      <section className="setting-section">
        <h2>Recording compatibility</h2>
        <div className="flex items-center gap-2 text-xs mb-3">
          {supported ? (
            <Check className="text-success" size={15} />
          ) : (
            <CircleAlert className="text-warning" size={15} />
          )}{" "}
          {supported === null
            ? "Checking this browser…"
            : supported
              ? "Tab capture and media recording are available."
              : "Screen recording is not supported in this browser."}
        </div>
        <p>Desktop Chrome or Edge, on HTTPS or localhost. Share the Test App tab when asked.</p>
      </section>
      <section className="setting-section">
        <h2 className="flex items-center gap-2">
          <HardDrive size={17} />
          Local storage
        </h2>
        <p>
          Everything is stored in this browser. Shared copies upload only when you choose, and are
          deleted separately.
        </p>
        <div className="text-xs mt-4">
          Browser origin usage:{" "}
          {storage?.usage === undefined
            ? "Not available"
            : `${(storage.usage / 1024 / 1024).toFixed(1)} MB`}{" "}
          · Available quota:{" "}
          {storage?.quota === undefined
            ? "Not available"
            : `${(storage.quota / 1024 / 1024 / 1024).toFixed(1)} GB`}
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const granted = await navigator.storage?.persist?.();
              setMessage(
                granted
                  ? "Persistent local storage granted."
                  : "Browser did not grant persistent storage. Export important sessions as a backup.",
              );
            }}
          >
            <ShieldCheck />
            Request persistent storage
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (
                window.confirm(
                  "Permanently delete ALL local recordings, events, findings, annotations, and preferences? This cannot be undone.",
                )
              ) {
                try {
                  await clearAll();
                  setSettings(defaultSampling);
                  setMessage("All local research data has been deleted.");
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : "Deletion failed.");
                }
              }
            }}
          >
            <Trash2 />
            Delete all local data
          </Button>
        </div>
      </section>
      {message && (
        <div className="info-note mt-5" role="status">
          {message}
        </div>
      )}
    </Shell>
  );
}
