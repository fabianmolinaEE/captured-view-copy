// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { CaptureController } from "@/lib/research/capture";
import type { Session } from "@/lib/research/types";
let handle = "";
let track: {
  getSettings: () => { displaySurface: string };
  getCaptureHandle: () => { handle: string } | null;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | undefined;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "video/webm";
  onstart?: () => void;
  onstop?: () => void;
  onerror?: () => void;
  ondataavailable?: (event: { data: Blob }) => void;
  constructor() {
    Recorder.instances.push(this);
  }
  start() {
    this.state = "recording";
    this.onstart?.();
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["video bytes"]) });
    this.onstop?.();
  }
}
beforeEach(() => {
  Recorder.instances = [];
  vi.spyOn(performance, "now").mockReturnValue(1000);
  track = {
    getSettings: () => ({ displaySurface: "browser" }),
    getCaptureHandle: () => ({ handle }),
    stop: vi.fn(),
    onended: undefined,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      setCaptureHandleConfig: (config: { handle: string }) => {
        handle = config.handle;
      },
      getDisplayMedia: vi
        .fn()
        .mockResolvedValue({ getVideoTracks: () => [track], getTracks: () => [track] }),
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("capture lifecycle", () => {
  it("saves exactly once with aligned events and duration when browser sharing ends", async () => {
    const saved = vi.fn<(s: Session) => void>();
    const states = vi.fn();
    const controller = new CaptureController(states);
    await controller.start("Real session", ["long_loading"], 6000, saved);
    vi.mocked(performance.now).mockReturnValue(2500);
    controller.logger.log("button_click", "browse");
    track.onended?.();
    controller.stop();
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const session = saved.mock.calls[0]![0];
    expect(session.duration_ms).toBe(1500);
    expect(session.events[0]?.t_ms).toBe(1500);
    expect(session.video_blob.size).toBeGreaterThan(0);
    expect(track.stop).toHaveBeenCalled();
    expect(states).toHaveBeenLastCalledWith("saved");
  });
  it("rejects a different tab and releases permissioned tracks", async () => {
    track.getCaptureHandle = () => ({ handle: "wrong-tab" });
    const saved = vi.fn();
    const states = vi.fn();
    await new CaptureController(states).start("Wrong", [], 0, saved);
    expect(states).toHaveBeenLastCalledWith(
      "error",
      expect.stringContaining("current browser tab"),
    );
    expect(track.stop).toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });
  it("handles denied permission without creating a session", async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    const saved = vi.fn();
    const states = vi.fn();
    await new CaptureController(states).start("Denied", [], 0, saved);
    expect(states).toHaveBeenLastCalledWith("error", expect.stringContaining("canceled or denied"));
    expect(saved).not.toHaveBeenCalled();
  });
  it("cancels a pending picker and cleans up a stream that resolves late", async () => {
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }) as Promise<MediaStream>,
    );
    const saved = vi.fn();
    const controller = new CaptureController(vi.fn());
    const start = controller.start("Canceled", [], 0, saved);
    controller.cancel();
    resolve({ getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream);
    await start;
    expect(track.stop).toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(Recorder.instances).toHaveLength(0);
  });
  it("prevents overlapping permission requests and repeated stop calls", async () => {
    const saved = vi.fn();
    const controller = new CaptureController(vi.fn());
    const first = controller.start("First", [], 0, saved);
    await controller.start("Second", [], 0, saved);
    await first;
    vi.mocked(performance.now).mockReturnValue(2500);
    controller.stop();
    controller.stop();
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  });
});

describe("early-stop and source lifecycle regressions", () => {
  it("does not save zero-second footage and supports a clean retry", async () => {
    const saved = vi.fn();
    const states = vi.fn();
    const controller = new CaptureController(states);
    await controller.start("Too short", ["missed_button"], 0, saved);
    controller.stop();
    expect(saved).not.toHaveBeenCalled();
    expect(states).toHaveBeenLastCalledWith(
      "error",
      expect.stringContaining("No usable session was saved"),
    );
    expect(track.stop).toHaveBeenCalled();
    vi.mocked(performance.now).mockReturnValue(2000);
    await controller.start("Retry", ["missed_button"], 0, saved);
    vi.mocked(performance.now).mockReturnValue(4000);
    controller.stop();
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(saved.mock.calls[0]![0]).toMatchObject({
      title: "Retry",
      duration_ms: 2000,
      capture_end_reason: "manual",
    });
  });
  it("uses a legitimate performance origin of zero and waits for final chunks after track end", async () => {
    vi.mocked(performance.now).mockReturnValue(0);
    const saved = vi.fn();
    const controller = new CaptureController(vi.fn());
    await controller.start("Clock zero", [], 0, saved);
    vi.mocked(performance.now).mockReturnValue(2000);
    const recorder = Recorder.instances[0]!;
    recorder.state = "inactive";
    track.onended?.();
    expect(saved).not.toHaveBeenCalled();
    recorder.ondataavailable?.({ data: new Blob(["final browser chunk"]) });
    recorder.onstop?.();
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(saved.mock.calls[0]![0].duration_ms).toBe(2000);
    expect(await saved.mock.calls[0]![0].video_blob.text()).toBe("final browser chunk");
  });
  it("does not restart the logger when a delayed start event follows a stop", async () => {
    const saved = vi.fn();
    const controller = new CaptureController(vi.fn());
    await controller.start("Delayed start", [], 0, saved);
    vi.mocked(performance.now).mockReturnValue(3000);
    controller.stop();
    Recorder.instances[0]!.onstart?.();
    controller.logger.log("late", "browse");
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(saved.mock.calls[0]![0].events).toHaveLength(0);
  });
  it("keeps recording when the source handle stays unavailable for a long time", async () => {
    vi.useFakeTimers();
    const saved = vi.fn();
    const controller = new CaptureController(vi.fn());
    await controller.start("Missing handle", [], 0, saved);
    const listener = track.addEventListener.mock.calls.find(
      (call) => call[0] === "capturehandlechange",
    )![1] as () => void;
    track.getCaptureHandle = () => null;
    listener();
    await vi.advanceTimersByTimeAsync(5000);
    track.getCaptureHandle = () => ({ handle: "" });
    listener();
    await vi.advanceTimersByTimeAsync(5000);
    expect(Recorder.instances[0]!.state).toBe("recording");
    expect(saved).not.toHaveBeenCalled();
  });
  it("ignores a transient missing source handle but stops a confirmed different source", async () => {
    vi.useFakeTimers();
    const states = vi.fn();
    const saved = vi.fn();
    const controller = new CaptureController(states);
    await controller.start("Source checks", [], 0, saved);
    const listener = track.addEventListener.mock.calls.find(
      (call) => call[0] === "capturehandlechange",
    )![1] as () => void;
    const ownHandle = handle;
    track.getCaptureHandle = () => null;
    listener();
    await vi.advanceTimersByTimeAsync(150);
    track.getCaptureHandle = () => ({ handle: ownHandle });
    listener();
    await vi.advanceTimersByTimeAsync(400);
    expect(Recorder.instances[0]!.state).toBe("recording");
    expect(saved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    track.getCaptureHandle = () => ({ handle: "another-tab" });
    listener();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0]![0].capture_end_reason).toBe("source_changed");
    expect(saved.mock.calls[0]![0].capture_region).toBeUndefined();
  });
  it("clears capture-source listeners when a session is finished", async () => {
    const saved = vi.fn();
    const controller = new CaptureController(vi.fn());
    await controller.start("Cleanup", [], 0, saved);
    vi.mocked(performance.now).mockReturnValue(3000);
    controller.stop();
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(track.onended).toBeNull();
    expect(track.removeEventListener).toHaveBeenCalledWith(
      "capturehandlechange",
      expect.any(Function),
    );
  });
});
