import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestApp } from "@/components/research/TestApp";
const mocks = vi.hoisted(() => ({ saveSession: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  saveSession: mocks.saveSession,
  downloadFile: vi.fn(),
}));
vi.mock("@fix-webm-duration/fix", () => ({ fixWebmDuration: async (blob: Blob) => blob }));
let handle = "";
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
  ondataavailable?: (e: { data: Blob }) => void;
  constructor() {
    Recorder.instances.push(this);
  }
  start() {
    this.state = "recording";
    queueMicrotask(() => this.onstart?.());
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["captured bytes"]) });
    this.onstop?.();
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  Recorder.instances = [];
  mocks.saveSession.mockReset().mockResolvedValue(undefined);
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("MediaRecorder", Recorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      setCaptureHandleConfig: (config: { handle: string }) => {
        handle = config.handle;
      },
      getDisplayMedia: vi.fn().mockResolvedValue({
        getVideoTracks: () => [
          {
            getSettings: () => ({ displaySurface: "browser" }),
            getCaptureHandle: () => ({ handle }),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            stop: vi.fn(),
          },
        ],
        getTracks: () => [],
      }),
    },
  });
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("innerHeight", 900);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    x: 400,
    y: 82,
    left: 400,
    top: 82,
    width: 365,
    height: innerHeight - 155,
    right: 765,
    bottom: innerHeight - 73,
    toJSON() {
      return {};
    },
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function recordSmallButton() {
  render(<TestApp initialDemo="checkout" />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Long loading/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Missed button/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Share this tab/ }));
  });
  expect(screen.getByText("Recording this session")).toBeInTheDocument();
}
describe("recording the small-button scenario", () => {
  it("survives startup resize, keeps the tiny target functional, and saves only after Stop", async () => {
    await recordSmallButton();
    act(() => window.dispatchEvent(new Event("resize")));
    expect(Recorder.instances[0]?.state).toBe("recording");
    expect(mocks.saveSession).not.toHaveBeenCalled();
    act(() => {
      vi.stubGlobal("innerHeight", 840);
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(500);
    });
    expect(Recorder.instances[0]?.state).toBe("recording");
    expect(mocks.saveSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Explore the bag/ }));
    const tiny = screen.getByRole("button", { name: "Checkout" });
    expect(tiny).toHaveClass("tiny-target");
    fireEvent.pointerDown(tiny.parentElement!, { clientX: 410, clientY: 300 });
    fireEvent.click(tiny);
    expect(screen.getByText("Where to?")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2500);
      fireEvent.click(screen.getByRole("button", { name: /Stop & save/ }));
    });
    expect(mocks.saveSession).toHaveBeenCalledTimes(1);
    const saved = mocks.saveSession.mock.calls[0]![0];
    expect(saved.duration_ms).toBeGreaterThanOrEqual(3000);
    expect(saved.scenario_config).toEqual(["missed_button"]);
    expect(saved.capture_region).toBeDefined();
    expect(saved.capture_region_valid_from_ms).toBeGreaterThan(0);
    expect(saved.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tap", metadata: expect.objectContaining({ hit: false }) }),
        expect.objectContaining({ target_id: "go_delivery_form" }),
      ]),
    );
  });
  it("does not let a resize after stopping overwrite the final crop", async () => {
    await recordSmallButton();
    await act(async () => {
      vi.advanceTimersByTime(2000);
      fireEvent.click(screen.getByRole("button", { name: /Stop & save/ }));
    });
    expect(mocks.saveSession).toHaveBeenCalledTimes(1);
    act(() => {
      vi.stubGlobal("innerHeight", 700);
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(500);
    });
    expect(mocks.saveSession).toHaveBeenCalledTimes(1);
  });
});

describe("delivery capture provenance", () => {
  it("records delivery interactions with correct source, crop and unknown ground truth", async () => {
    render(<TestApp initialDemo="delivery" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Share this tab/ }));
    });
    expect(screen.queryByText("Choose your size")).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("img", { name: /Vegetable pizza/ }), {
      clientX: 500,
      clientY: 250,
    });
    fireEvent.click(screen.getAllByRole("button", { name: /View item/ })[0]!);
    fireEvent.click(screen.getByRole("radio", { name: /Large/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add to basket/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit item" }));
    await act(async () => {
      vi.advanceTimersByTime(5000);
      fireEvent.click(screen.getByRole("button", { name: /Stop & save/ }));
    });
    expect(mocks.saveSession).toHaveBeenCalledTimes(1);
    const saved = mocks.saveSession.mock.calls[0]![0];
    expect(saved.source_app).toBe("Miso food delivery");
    expect(saved.capture_region).toBeDefined();
    expect(saved.issues).toHaveLength(3);
    expect(
      saved.issues.every(
        (issue: { actually_observed: string }) => issue.actually_observed === "unknown",
      ),
    ).toBe(true);
    expect(saved.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "pointer_down",
          screen: "delivery_menu",
          metadata: expect.objectContaining({ hit: false }),
        }),
        expect.objectContaining({
          type: "backtrack",
          screen: "delivery_basket",
          target_id: "edit_item",
        }),
      ]),
    );
    expect(JSON.stringify(saved.events)).not.toContain("1847 West");
  });
});
