import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { makeSession } from "./research-fixtures";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    params,
    search,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: { t?: number };
  } & Record<string, unknown>) => {
    const path = Object.entries(params ?? {}).reduce(
      (href, [key, value]) => href.replace(`$${key}`, value),
      to,
    );
    return (
      <a href={search?.t !== undefined ? `${path}?t=${search.t}` : path} {...rest}>
        {children}
      </a>
    );
  },
}));

import { EvidenceThumbnail } from "@/components/research/EvidencePanel";
import { captureVideoFrame } from "@/lib/research/evidence";
import { pregeneratedLabel, youtubeThumbnailUrl } from "@/lib/research/publicVideo";

const publicVideo = {
  url: "https://www.youtube.com/watch?v=EFCmkDTBYck",
  video_id: "EFCmkDTBYck",
  creator: "Creator",
  published_label: "June 2026",
  context: "Walkthrough",
  start_ms: 0,
  end_ms: 120000,
  duration_verified: true,
  footage_reviewed_at: "2026-11-13T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("highlight thumbnails", () => {
  it("public videos use YouTube's poster with the timestamp, and fall back on error", () => {
    const session = makeSession({
      video_blob: new Blob(),
      capture_mode: "public_youtube",
      public_video: publicVideo,
    });
    render(<EvidenceThumbnail session={session} timeMs={65000} />);
    const thumb = screen.getByTestId("evidence-thumbnail");
    expect(thumb).toHaveAttribute("data-kind", "poster");
    const img = thumb.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://i.ytimg.com/vi/EFCmkDTBYck/mqdefault.jpg");
    expect(thumb).toHaveTextContent("01:05");
    fireEvent.error(img);
    expect(thumb).toHaveAttribute("data-kind", "placeholder");
    expect(thumb.querySelector("img")).toBeNull();
    expect(thumb).toHaveTextContent("01:05");
  });

  it("rejects malformed ids instead of building a thumbnail URL", () => {
    expect(youtubeThumbnailUrl("not-an-id")).toBeNull();
    expect(youtubeThumbnailUrl("EFCmkDTBYck", "hqdefault")).toBe(
      "https://i.ytimg.com/vi/EFCmkDTBYck/hqdefault.jpg",
    );
  });

  it("local recordings show a placeholder (never black) until a real frame is painted", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    const session = makeSession({ video_blob: new Blob(["x"], { type: "video/webm" }) });
    vi.useFakeTimers();
    try {
      render(<EvidenceThumbnail session={session} timeMs={3000} />);
      expect(screen.getByTestId("evidence-thumbnail")).toHaveAttribute("data-kind", "placeholder");
      // jsdom never decodes, so the grab times out and the placeholder stays.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9000);
      });
      expect(screen.getByTestId("evidence-thumbnail")).toHaveAttribute("data-kind", "placeholder");
    } finally {
      vi.useRealTimers();
    }
  });

  it("grabs a frame by seeking an offscreen video and always revokes its object URL", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:thumb");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    let video: HTMLVideoElement | undefined;
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const element = original(tag);
      if (tag === "video") video = element as HTMLVideoElement;
      if (tag === "canvas") {
        Object.assign(element, {
          getContext: () => ({
            drawImage: vi.fn(),
            getImageData: () => ({ data: new Uint8ClampedArray(16).fill(120) }),
          }),
          toDataURL: () => "data:image/jpeg;base64,AAAA",
        });
      }
      return element;
    }) as typeof document.createElement);
    const blob = new Blob(["frame"], { type: "video/webm" });
    const pending = captureVideoFrame(blob, 4000, { recordingKey: "session-a" });
    await waitFor(() => expect(video).toBeDefined());
    Object.defineProperty(video!, "videoWidth", { value: 640 });
    Object.defineProperty(video!, "videoHeight", { value: 360 });
    Object.defineProperty(video!, "duration", { value: 10 });
    let readyState = 1;
    Object.defineProperty(video!, "readyState", { get: () => readyState });
    video!.dispatchEvent(new Event("loadedmetadata"));
    video!.dispatchEvent(new Event("loadeddata"));
    expect(video!.currentTime).toBe(4);
    // `seeked` before the frame is decoded must not paint an empty canvas.
    video!.dispatchEvent(new Event("seeked"));
    readyState = 2;
    video!.dispatchEvent(new Event("canplay"));
    await expect(pending).resolves.toBe("data:image/jpeg;base64,AAAA");
    expect(created).toHaveBeenCalledWith(blob);
    expect(revoked).toHaveBeenCalledWith("blob:thumb");
    // Cached: the same moment does not decode the recording again, even for a re-read Blob
    // (IndexedDB returns a new object on every read) of the same recording.
    await expect(captureVideoFrame(blob, 4000, { recordingKey: "session-a" })).resolves.toBe(
      "data:image/jpeg;base64,AAAA",
    );
    const reread = new Blob(["frame"], { type: "video/webm" });
    await expect(captureVideoFrame(reread, 4000, { recordingKey: "session-a" })).resolves.toBe(
      "data:image/jpeg;base64,AAAA",
    );
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("treats an all-black canvas as no frame, so the placeholder shows", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:black");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    let video: HTMLVideoElement | undefined;
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const element = original(tag);
      if (tag === "video") video = element as HTMLVideoElement;
      if (tag === "canvas") {
        Object.assign(element, {
          getContext: () => ({
            drawImage: vi.fn(),
            getImageData: () => ({ data: new Uint8ClampedArray(16) }),
          }),
          toDataURL: () => "data:image/jpeg;base64,BLACK",
        });
      }
      return element;
    }) as typeof document.createElement);
    const pending = captureVideoFrame(new Blob(["black"], { type: "video/webm" }), 2000, {
      recordingKey: "session-black",
    });
    await waitFor(() => expect(video).toBeDefined());
    Object.defineProperty(video!, "videoWidth", { value: 640 });
    Object.defineProperty(video!, "videoHeight", { value: 360 });
    Object.defineProperty(video!, "readyState", { value: 4 });
    video!.dispatchEvent(new Event("loadeddata"));
    video!.dispatchEvent(new Event("seeked"));
    await expect(pending).resolves.toBeNull();
  });

  it("resolves null without a DOM-decodable file and for empty blobs", async () => {
    await expect(captureVideoFrame(new Blob(), 0)).resolves.toBeNull();
  });
});

describe("pre-generated labels", () => {
  it("names the Explorer for competitor footage and the Tracker otherwise", () => {
    const pregenerated = {
      source: "tracker-runs",
      generated_at: "2026-11-13T10:00:00.000Z",
      note: "",
      run_ids: [],
      imported_at: "2026-11-13T10:00:00.000Z",
    } as never;
    expect(pregeneratedLabel({ pregenerated })).toBe("Tracker run · pre-generated Nov 13");
    expect(pregeneratedLabel({ pregenerated, public_video: { competitor_of: "uber-eats" } })).toBe(
      "Explorer run · pre-generated Nov 13",
    );
  });
});
