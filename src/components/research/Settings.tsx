import { useEffect, useState } from "react";
import { Check, CircleAlert, HardDrive, ShieldCheck, Trash2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, PageHeading } from "./Shell";
import { clearAll, getSampling, saveSampling } from "@/lib/research/sessionStorage";
import { captureSupport } from "@/lib/research/capture";
import { connectionStatus, saveAccessCode, type ConnectionStatus } from "@/lib/research/apiClient";
import { defaultSampling, type SamplingSettings } from "@/lib/research/types";
export function Settings() {
  const [settings, setSettings] = useState<SamplingSettings>(defaultSampling);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [storage, setStorage] = useState<StorageEstimate>();
  const [connection, setConnection] = useState<ConnectionStatus>();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
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
  return (
    <Shell section="Settings">
      <PageHeading
        title="Settings"
        description="Capture compatibility, local storage, and AI transparency."
      />
      <section className="setting-section pt-0">
        <div className="flex items-center justify-between">
          <h2>AI connection</h2>
          <span className="status-badge">
            {connection?.configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p>{connection?.message ?? "Checking server configuration…"}</p>
        <p>
          Model: {connection?.model ?? "Unknown"} · Cost: unavailable. API keys stay on the server.
        </p>
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
          The workspace code grants access to team recordings and analysis. It is kept in this tab’s
          session storage. Shared storage:{" "}
          {connection?.backend_configured ? "configured" : "not configured; sessions remain local"}.
        </p>
      </section>
      <section className="setting-section">
        <h2>Video sampling</h2>
        <p>
          Sampling preferences are saved locally and used for real analysis. Ground truth and
          scenario settings are excluded from model inputs.
        </p>
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
        <p>
          Use desktop Chrome or Edge on HTTPS or localhost. Screen sharing always requires explicit
          permission. Select the current Test App tab; native mobile apps and outside-app capture
          are not supported.
        </p>
      </section>
      <section className="setting-section">
        <h2 className="flex items-center gap-2">
          <HardDrive size={17} />
          Local storage
        </h2>
        <p>
          Videos, event logs, annotations, and evaluation labels are stored in this browser using
          IndexedDB. Shared copies are uploaded only with explicit approval in session review.
          Clearing browser data removes local copies; shared copies have separate deletion controls.
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
