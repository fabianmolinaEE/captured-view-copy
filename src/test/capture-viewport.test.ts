import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutRegion, watchCaptureViewport } from "@/lib/research/captureViewport";
import { sampleTimes } from "@/lib/research/frameSampler";
import { defaultSampling } from "@/lib/research/types";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const rectangle = (left = 100, top = 80, width = 300, height = 500) => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON() {
    return {};
  },
});
describe("safe viewport crop while recording", () => {
  it("ignores redundant startup resize and revalidates actual changes after a debounce", () => {
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 900);
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(() =>
      rectangle(100, 80, 300, innerHeight - 160),
    );
    const controller = { setRegion: vi.fn(), invalidateRegion: vi.fn(), elapsed: () => 750 };
    const adjusted = vi.fn();
    const cleanup = watchCaptureViewport(element, controller, adjusted);
    expect(controller.setRegion).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("resize"));
    expect(controller.invalidateRegion).not.toHaveBeenCalled();
    vi.stubGlobal("innerHeight", 850);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
    vi.stubGlobal("innerHeight", 830);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(200);
    expect(controller.setRegion).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50);
    expect(controller.setRegion).toHaveBeenLastCalledWith(
      expect.objectContaining({ y: 80 / 830 }),
      750,
    );
    expect(adjusted).toHaveBeenCalledTimes(1);
    cleanup();
    window.dispatchEvent(new Event("resize"));
    expect(controller.setRegion).toHaveBeenCalledTimes(2);
  });
  it("cancels an outstanding crop adjustment on cleanup", () => {
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 900);
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rectangle());
    const controller = { setRegion: vi.fn(), invalidateRegion: vi.fn(), elapsed: () => 500 };
    const cleanup = watchCaptureViewport(element, controller, vi.fn());
    vi.stubGlobal("innerHeight", 800);
    window.dispatchEvent(new Event("resize"));
    cleanup();
    vi.advanceTimersByTime(500);
    expect(controller.setRegion).toHaveBeenCalledTimes(1);
  });
  it("refuses empty geometry and bounds the crop to the viewport", () => {
    expect(checkoutRegion(rectangle(), 0, 500)).toBeUndefined();
    expect(checkoutRegion(rectangle(0, 900), 800, 600)).toBeUndefined();
    expect(checkoutRegion(rectangle(-20, 10, 100, 100), 400, 200)).toEqual({
      x: 0,
      y: 0.05,
      width: 0.2,
      height: 0.5,
    });
  });
  it("samples only valid post-resize footage while keeping original session timestamps", () => {
    const times = sampleTimes(10000, [], defaultSampling, 750);
    expect(times[0]).toBe(750);
    expect(times.at(-1)).toBe(9900);
    expect(times.every((time) => time >= 750 && time < 10000)).toBe(true);
    expect(times.length).toBeLessThanOrEqual(24);
    expect(sampleTimes(1000, [], defaultSampling, 1000)).toEqual([]);
  });
});
