import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSourceLibrary, UberEatsSources } from "@/components/research/UberEatsSources";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import { doorDashCandidates } from "@/lib/research/competitors";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/research/sessionStorage", () => ({
  saveSession: mocks.save,
  listSessions: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: () => null,
}));
vi.mock("@/components/research/PublicVideoPlayer", () => ({
  PublicVideoPlayer: ({
    onDuration,
    onPlaybackError,
    title,
  }: {
    onDuration: (ms: number) => void;
    onPlaybackError?: (code: number) => void;
    title: string;
  }) => (
    <div data-testid="player" title={title}>
      <button onClick={() => onDuration(120000)}>Report player duration</button>
      <button onClick={() => onPlaybackError?.(150)}>Report embed error</button>
    </div>
  ),
}));
beforeEach(() => mocks.save.mockReset().mockResolvedValue(undefined));
afterEach(cleanup);
describe("Uber Eats source intake", () => {
  it("plays a candidate in-page and saves it in two clicks once the player reports duration", async () => {
    const added = vi.fn();
    render(<UberEatsSources sessions={[]} onSaved={added} />);
    expect(screen.getAllByText("Available")).toHaveLength(5);
    expect(screen.queryByTestId("player")).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: `Play ${uberEatsCandidates[0].title} here` }),
    );
    const preview = screen.getByRole("region", {
      name: `Preview of ${uberEatsCandidates[0].title}`,
    });
    expect(within(preview).getByText(/By 4kEasyGuide · June 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save clip/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Report player duration" }));
    expect(screen.getByText("Clip 00:00–02:00 of 02:00")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /save clip/ })));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(added).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0]![0]).toMatchObject({
      source_app: "Uber Eats",
      events: [],
      findings: [],
      duration_ms: 120000,
      public_video: { start_ms: 0, end_ms: 120000, creator: "4kEasyGuide" },
    });
    expect(mocks.save.mock.calls[0]![0].public_video.competitor_of).toBeUndefined();
  });
  it("rejects an invalid segment without saving", async () => {
    render(<UberEatsSources sessions={[]} onSaved={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Play .* here/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Report player duration" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Segment end (seconds)" }), {
      target: { value: "999" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /save clip/ })));
    expect(screen.getByRole("alert")).toHaveTextContent(/Choose a segment/);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("marks saved candidates and offers to open them instead of saving twice", () => {
    const saved = createPublicSession(uberEatsCandidates[1], 120000, 0, 60000);
    render(<UberEatsSources sessions={[saved]} onSaved={vi.fn()} />);
    expect(screen.getAllByText("Saved")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: `Play ${uberEatsCandidates[1].title} here` }),
    );
    expect(screen.getByText("Open saved recording")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save clip/ })).not.toBeInTheDocument();
  });
  it("explains the attach-original fallback when the embed is blocked", () => {
    render(<UberEatsSources sessions={[]} onSaved={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Play .* here/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Report embed error" }));
    expect(screen.getByText(/attach the original video file/)).toBeInTheDocument();
  });
  it("saves DoorDash footage as Explorer competitor sessions linked to Uber Eats", async () => {
    const added = vi.fn();
    render(<PublicSourceLibrary sessions={[]} onSaved={added} includeCompetitors />);
    const competitor = screen.getByRole("region", { name: "Competitor footage · Explorer" });
    expect(within(competitor).getAllByText("Available")).toHaveLength(doorDashCandidates.length);
    expect(within(competitor).getByText(/never count toward Uber Eats/)).toBeInTheDocument();
    fireEvent.click(
      within(competitor).getByRole("button", { name: `Play ${doorDashCandidates[0]!.title} here` }),
    );
    // One preview at a time across both groups.
    expect(screen.getAllByTestId("player")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Report player duration" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /save clip/ })));
    expect(mocks.save.mock.calls[0]![0]).toMatchObject({
      source_app: "DoorDash",
      capture_mode: "public_youtube",
      events: [],
      public_video: { video_id: doorDashCandidates[0]!.id, competitor_of: "uber-eats" },
    });
    expect(added).toHaveBeenCalledTimes(1);
  });
});
