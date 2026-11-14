import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { youtubePlaybackError } from "@/lib/research/publicVideo";
import { PublicVideoPlayer } from "@/components/research/PublicVideoPlayer";
const instances: Player[] = [];
class Player {
  time = 30;
  options: { events: { onReady: () => void; onError: (event: { data: number }) => void } };
  destroy = vi.fn();
  pauseVideo = vi.fn();
  playVideo = vi.fn();
  seekTo = vi.fn();
  getDuration = () => 120;
  getCurrentTime = () => this.time;
  constructor(_element: HTMLElement, options: Player["options"]) {
    this.options = options;
    instances.push(this);
    queueMicrotask(options.events.onReady);
  }
}
beforeEach(() => {
  instances.length = 0;
  vi.useFakeTimers();
  Object.defineProperty(window, "YT", { configurable: true, value: { Player } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, "YT");
});
describe("public source playback", () => {
  it("reads player metadata, bounds highlight playback and destroys player/polling on unmount", async () => {
    const duration = vi.fn();
    const position = vi.fn();
    const view = render(
      <PublicVideoPlayer
        videoId="EFCmkDTBYck"
        startMs={30000}
        endMs={34000}
        onDuration={duration}
        onTimeUpdate={position}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(duration).toHaveBeenCalledWith(120000);
    expect(position).toHaveBeenCalledWith(30000);
    const frame = screen.getByTitle("Session recording");
    expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(frame.getAttribute("src")).toContain(encodeURIComponent(window.location.origin));
    expect(frame.getAttribute("allow")).toContain("encrypted-media");
    view.rerender(
      <PublicVideoPlayer
        videoId="EFCmkDTBYck"
        startMs={30000}
        endMs={34000}
        playToken={1}
        onDuration={duration}
      />,
    );
    expect(instances.at(-1)!.playVideo).toHaveBeenCalled();
    expect(instances.at(-1)!.seekTo).toHaveBeenCalledWith(30, true);
    instances.at(-1)!.pauseVideo.mockClear();
    instances.at(-1)!.time = 35;
    act(() => vi.advanceTimersByTime(300));
    expect(instances.at(-1)!.pauseVideo).toHaveBeenCalled();
    const player = instances.at(-1)!;
    view.unmount();
    expect(player.destroy).toHaveBeenCalledTimes(1);
    const calls = duration.mock.calls.length;
    act(() => vi.advanceTimersByTime(1000));
    expect(duration).toHaveBeenCalledTimes(calls);
  });
  it("reports unavailable or blocked embeds without fabricating metadata", async () => {
    const duration = vi.fn();
    render(<PublicVideoPlayer videoId="EFCmkDTBYck" onDuration={duration} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      instances.at(-1)!.options.events.onError({ data: 101 });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("owner has disabled");
    expect(duration).not.toHaveBeenCalled();
  });
  it("keeps the native embed available if the extra JavaScript controls cannot load", async () => {
    Reflect.deleteProperty(window, "YT");
    render(<PublicVideoPlayer videoId="EFCmkDTBYck" />);
    expect(screen.getByTitle("Session recording")).toBeInTheDocument();
    const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')!;
    await act(async () => {
      script.dispatchEvent(new Event("error"));
    });
    expect(screen.getByTitle("Session recording")).toBeInTheDocument();
    expect(screen.getByText(/Timeline controls could not connect/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload player" })).toBeInTheDocument();
  });
  it("distinguishes owner restrictions from missing client identity and unavailable videos", () => {
    expect(youtubePlaybackError(150)).toContain("owner has disabled");
    expect(youtubePlaybackError(101)).toContain("owner has disabled");
    expect(youtubePlaybackError(153)).toContain("site's identity");
    expect(youtubePlaybackError(100)).toContain("unavailable");
    expect(youtubePlaybackError(2)).toContain("error 2");
    expect(youtubePlaybackError(5)).toContain("error 5");
  });
  it("builds the documented embed URL with a fixed clip end and the required parameters", () => {
    render(
      <PublicVideoPlayer videoId="EFCmkDTBYck" startMs={30500} endMs={34000} clipEndMs={90200} />,
    );
    const src = new URL(screen.getByTitle("Session recording").getAttribute("src")!);
    expect(src.origin + src.pathname).toBe("https://www.youtube.com/embed/EFCmkDTBYck");
    expect(Object.fromEntries(src.searchParams)).toEqual({
      enablejsapi: "1",
      origin: window.location.origin,
      playsinline: "1",
      rel: "0",
      start: "30",
      end: "91",
    });
  });
  it("re-seeks and plays when the same highlight is chosen again", async () => {
    const view = render(<PublicVideoPlayer videoId="EFCmkDTBYck" startMs={30000} playToken={1} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const player = instances.at(-1)!;
    player.seekTo.mockClear();
    player.playVideo.mockClear();
    view.rerender(<PublicVideoPlayer videoId="EFCmkDTBYck" startMs={30000} playToken={2} />);
    expect(player.seekTo).toHaveBeenCalledWith(30, true);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
  });
  it("pauses once at the highlight end, then lets the viewer keep watching", async () => {
    render(<PublicVideoPlayer videoId="EFCmkDTBYck" startMs={30000} endMs={34000} playToken={1} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const player = instances.at(-1)!;
    player.time = 34.2;
    act(() => vi.advanceTimersByTime(300));
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    player.time = 40;
    act(() => vi.advanceTimersByTime(900));
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
  });
  it("does not call player methods before the IFrame API reports ready", async () => {
    class Slow {
      options: Player["options"];
      destroy = vi.fn();
      constructor(_element: HTMLElement, options: Player["options"]) {
        this.options = options;
      }
    }
    Object.defineProperty(window, "YT", { configurable: true, value: { Player: Slow } });
    const view = render(<PublicVideoPlayer videoId="EFCmkDTBYck" startMs={0} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(() =>
      view.rerender(<PublicVideoPlayer videoId="EFCmkDTBYck" startMs={42000} playToken={1} />),
    ).not.toThrow();
  });
  it("offers Watch on YouTube only after an embed error and reports the code", async () => {
    const failed = vi.fn();
    render(<PublicVideoPlayer videoId="EFCmkDTBYck" startMs={42000} onPlaybackError={failed} />);
    expect(screen.queryByRole("link", { name: /Watch on YouTube/ })).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      instances.at(-1)!.options.events.onError({ data: 150 });
    });
    expect(failed).toHaveBeenCalledWith(150);
    expect(screen.getByRole("link", { name: /Watch on YouTube/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=EFCmkDTBYck&t=42s",
    );
  });
  it("chains an existing onYouTubeIframeAPIReady handler instead of replacing it", async () => {
    vi.resetModules();
    Reflect.deleteProperty(window, "YT");
    const host = window as Window & { onYouTubeIframeAPIReady?: () => void };
    const other = vi.fn();
    host.onYouTubeIframeAPIReady = other;
    const { PublicVideoPlayer: Fresh } = await import("@/components/research/PublicVideoPlayer");
    render(<Fresh videoId="EFCmkDTBYck" />);
    expect(host.onYouTubeIframeAPIReady).not.toBe(other);
    Object.defineProperty(window, "YT", { configurable: true, value: { Player } });
    await act(async () => {
      host.onYouTubeIframeAPIReady?.();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(other).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    Reflect.deleteProperty(host, "onYouTubeIframeAPIReady");
    document
      .querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
      .forEach((node) => node.remove());
  });
});
