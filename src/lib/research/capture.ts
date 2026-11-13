import { fixWebmDuration } from "@fix-webm-duration/fix";
import { EventLogger } from "./eventLogger";
import { scenarios, type Category, type Session } from "./types";
export type CaptureState =
  "idle" | "requesting_permission" | "recording" | "stopping" | "saved" | "error";
export const MIN_CAPTURE_DURATION_MS = 1000;
type StopReason = NonNullable<Session["capture_end_reason"]>;
type CaptureTrack = MediaStreamTrack & { getCaptureHandle?: () => { handle?: string } | null };
export function captureSupport() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined"
  );
}
export class CaptureController {
  logger = new EventLogger();
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private stopping = false;
  private finalizing = false;
  private requesting = false;
  private canceled = false;
  private stoppedAt: number | null = null;
  private anchor: number | null = null;
  private pending: Session | undefined;
  private completed?: (session: Session) => void;
  private sourceListener: ((event: Event) => void) | undefined;
  constructor(private state: (state: CaptureState, error?: string) => void) {}
  async start(title: string, config: Category[], delay: number, onComplete: (s: Session) => void) {
    if (this.requesting || this.finalizing || this.recorder?.state === "recording") return;
    if (!captureSupport()) {
      this.state(
        "error",
        "Tab recording is unavailable here. Open this app in desktop Chrome or Edge over HTTPS.",
      );
      return;
    }
    this.requesting = true;
    this.canceled = false;
    this.stopping = false;
    this.anchor = null;
    this.stoppedAt = null;
    this.pending = undefined;
    this.chunks = [];
    this.state("requesting_permission");
    try {
      const handle = crypto.randomUUID();
      const devices = navigator.mediaDevices as MediaDevices & {
        setCaptureHandleConfig?: (config: unknown) => void;
      };
      devices.setCaptureHandleConfig?.({
        handle,
        exposeOrigin: true,
        permittedOrigins: [location.origin],
      });
      const options: DisplayMediaStreamOptions & {
        preferCurrentTab: boolean;
        selfBrowserSurface: string;
        surfaceSwitching: string;
        monitorTypeSurfaces: string;
      } = {
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "exclude",
      };
      this.stream = await navigator.mediaDevices.getDisplayMedia(options);
      if (this.canceled) {
        this.releaseStream();
        this.state("idle");
        return;
      }
      const track = this.stream.getVideoTracks()[0] as CaptureTrack | undefined;
      if (!track) throw new Error("No screen video was selected.");
      if (track.getSettings().displaySurface && track.getSettings().displaySurface !== "browser")
        throw new Error(
          "Please select a browser tab rather than a screen or window, then choose the Test App tab.",
        );
      if (track.getCaptureHandle && track.getCaptureHandle()?.handle !== handle)
        throw new Error(
          "Select this app’s current browser tab. Other tabs cannot produce aligned checkout events.",
        );
      const mime = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.completed = onComplete;
      const now = new Date().toISOString(),
        id = crypto.randomUUID();
      this.pending = {
        id,
        title: title.trim() || "Checkout research session",
        created_at: now,
        captured_at: now,
        duration_ms: 0,
        video_blob: new Blob(),
        mime_type: this.recorder.mimeType,
        extension: this.recorder.mimeType.includes("mp4") ? "mp4" : "webm",
        capture_mode: "browser_tab",
        source_app: "Carry checkout",
        scenario_config: [...config],
        loading_delay_ms: delay,
        status: "captured",
        consent_confirmed: true,
        event_count: 0,
        events: [],
        findings: [],
        issues: scenarios
          .filter((s) => config.includes(s.id))
          .map((s) => ({
            id: crypto.randomUUID(),
            category: s.id,
            screen: s.screen,
            actually_observed: "unknown",
          })),
        matches: [],
        runs: [],
        video_start_offset_ms: 0,
      };
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data);
      };
      this.recorder.onstop = () => void this.finalize();
      this.recorder.onerror = () => this.stop("recorder_error");
      track.onended = () => this.stop("browser_stop");
      if (track.getCaptureHandle) {
        this.sourceListener = () => {
          const current = track.getCaptureHandle?.()?.handle;
          // Only a confirmed *different* handle proves the source changed. Chrome can report no
          // handle for an arbitrary period while self-capturing (surface switching is excluded
          // and only this page sets the handle), so a missing handle must never end the session.
          if (!current || current === handle || this.stopping) return;
          this.invalidateRegion();
          this.stop("source_changed");
        };
        track.addEventListener?.("capturehandlechange", this.sourceListener);
      }
      this.recorder.onstart = () => {
        if (this.stopping || this.canceled || this.recorder?.state !== "recording") return;
        this.state("recording");
      };
      // Begin the clock and logger together before the recorder's asynchronous start event.
      this.anchor = performance.now();
      this.logger.start(id, this.anchor);
      this.recorder.start(500);
    } catch (error) {
      this.logger.stop();
      this.pending = undefined;
      this.releaseStream();
      this.state(
        "error",
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Screen sharing was canceled or denied. Nothing was recorded. Try again and select this tab."
          : error instanceof Error
            ? error.message
            : "Screen recording could not start.",
      );
    } finally {
      this.requesting = false;
    }
  }
  elapsed() {
    return this.anchor === null
      ? 0
      : Math.max(0, Math.round((this.stoppedAt ?? performance.now()) - this.anchor));
  }
  setRegion(region: NonNullable<Session["capture_region"]>, validFromMs = 0) {
    if (this.pending && !this.stopping) {
      this.pending.capture_region = region;
      this.pending.capture_region_valid_from_ms = Math.max(0, Math.round(validFromMs));
    }
  }
  invalidateRegion() {
    if (this.pending) {
      delete this.pending.capture_region;
      delete this.pending.capture_region_valid_from_ms;
    }
  }
  cancel() {
    this.canceled = true;
    if (!this.requesting) this.stop("navigation");
  }
  stop(reason: StopReason = "manual") {
    if (this.stopping || !this.recorder || !this.pending) return;
    this.stopping = true;
    this.stoppedAt = performance.now();
    this.pending.duration_ms = this.elapsed();
    this.pending.events = this.logger.stop();
    this.pending.capture_end_reason = reason;
    this.state("stopping");
    if (this.recorder.state !== "inactive") this.recorder.stop();
    // If the browser already set inactive, its final dataavailable/onstop events still own finalization.
  }
  private releaseStream() {
    this.stream?.getVideoTracks().forEach((track) => {
      track.onended = null;
      if (this.sourceListener)
        track.removeEventListener?.("capturehandlechange", this.sourceListener);
    });
    this.sourceListener = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
  }
  private async finalize() {
    if (this.finalizing || !this.pending) return;
    this.finalizing = true;
    if (!this.stopping) {
      this.stopping = true;
      this.stoppedAt = performance.now();
      this.pending.duration_ms = this.elapsed();
      this.pending.events = this.logger.stop();
      this.pending.capture_end_reason = "browser_stop";
      this.state("stopping");
    }
    this.releaseStream();
    const finished = this.pending;
    this.pending = undefined;
    const chunks = this.chunks;
    this.chunks = [];
    if (finished.duration_ms < MIN_CAPTURE_DURATION_MS || !chunks.length) {
      this.finalizing = false;
      const cause =
        finished.capture_end_reason === "source_changed"
          ? "The shared source changed."
          : finished.capture_end_reason === "recorder_error"
            ? "The browser interrupted capture."
            : "Recording ended too quickly.";
      this.state(
        "error",
        `${cause} No usable session was saved. Try again, select this app’s current tab, and record for at least one second.`,
      );
      return;
    }
    finished.video_blob = new Blob(chunks, { type: finished.mime_type });
    finished.event_count = finished.events.length;
    if (finished.mime_type.includes("webm"))
      finished.video_blob = await fixWebmDuration(finished.video_blob, finished.duration_ms, {
        logger: false,
      });
    this.finalizing = false;
    const warning =
      finished.capture_end_reason === "source_changed"
        ? "The shared source changed. The captured recording was saved; multimodal analysis is disabled for this session."
        : finished.capture_end_reason === "recorder_error"
          ? "The browser interrupted capture. Captured footage was saved for recovery."
          : undefined;
    if (warning) this.state("saved", warning);
    else this.state("saved");
    this.completed?.(finished);
  }
}
