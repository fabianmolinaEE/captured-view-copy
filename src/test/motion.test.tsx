import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMotionPreference } from "@/hooks/use-motion-preference";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
import { LoopJourney } from "@/components/research/LoopJourney";
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("closed-loop exploration", () => {
  it("cycles Discover, Test and Grow while labeling simulated stages", () => {
    render(<LoopJourney />);
    expect(screen.getByRole("button", { name: "Insights" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Tracker + Explorer · Real")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Competitors" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "A/B Tests" }));
    expect(screen.getByText("Experimenter · Simulated demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Give a promising idea/ })).toHaveAttribute(
      "href",
      "/ab-tests",
    );
    fireEvent.click(screen.getByRole("button", { name: "Rollouts" }));
    expect(screen.getByText(/PRs are simulated in this prototype/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next part of the loop" }));
    expect(screen.getByRole("button", { name: "Insights" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Product vision")).toBeInTheDocument();
  });
});
describe("decorative motion preference", () => {
  it("persists a manual pause through remounting and can resume", () => {
    const view = renderHook(() => useMotionPreference());
    expect(view.result.current.enabled).toBe(true);
    act(() => view.result.current.toggle());
    expect(view.result.current.enabled).toBe(false);
    expect(localStorage.getItem("loopmate-motion")).toBe("paused");
    view.unmount();
    const again = renderHook(() => useMotionPreference());
    expect(again.result.current.enabled).toBe(false);
    act(() => again.result.current.toggle());
    expect(again.result.current.enabled).toBe(true);
  });
  it("honors system reduced motion and reacts when it changes", () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_event: string, listener: () => void) =>
        listeners.delete(listener),
      ),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    localStorage.setItem("loopmate-motion", "enabled");
    const view = renderHook(() => useMotionPreference());
    expect(view.result.current.enabled).toBe(false);
    act(() => view.result.current.toggle());
    expect(view.result.current.enabled).toBe(false);
    act(() => {
      media.matches = false;
      listeners.forEach((fn) => fn());
    });
    expect(view.result.current.enabled).toBe(true);
    view.unmount();
    expect(listeners.size).toBe(0);
  });
});
