import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import { createCompetitorSession, doorDashCandidates } from "@/lib/research/competitors";
import { selectProduct } from "@/hooks/use-product";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";
const store = vi.hoisted(() => ({
  session: undefined as Session | undefined,
  player: [] as Array<Record<string, unknown>>,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));
vi.mock("@/components/research/AnalysisPanel", () => ({ AnalysisPanel: () => null }));
vi.mock("@/components/research/SharedSessionPanel", () => ({ SharedSessionPanel: () => null }));
vi.mock("@/components/research/PublicVideoPlayer", () => ({
  PublicVideoPlayer: (
    props: Record<string, unknown> & { onPlaybackError?: (c: number) => void },
  ) => {
    store.player.push(props);
    return (
      <button type="button" onClick={() => props.onPlaybackError?.(101)}>
        Simulate blocked embed
      </button>
    );
  },
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  getSession: async () => store.session,
  saveSession: async (session: Session) => {
    store.session = structuredClone(session);
  },
  deleteSession: vi.fn(),
  downloadFile: vi.fn(),
  exportSession: vi.fn(),
  listSessions: async () => (store.session ? [store.session] : []),
}));
import { SessionReview } from "@/components/research/SessionReview";
function withFinding(session: Session, timestamp: number) {
  const run = makeRun({ mode: "public_video" });
  session.runs = [run];
  session.findings = [
    makeFinding({
      analysis_run_id: run.id,
      title: "Reorder is hard to find",
      timestamp_ms: timestamp,
      event_ids: [],
      evidence_sources: ["video"],
      review_status: "pending",
    }),
  ];
  return session;
}
beforeEach(() => {
  store.player = [];
  selectProduct(null);
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  sessionStorage.clear();
});
describe("public recording review", () => {
  it("plays the saved clip in-page and re-seeks on every highlight click", async () => {
    store.session = withFinding(
      createPublicSession(uberEatsCandidates[0], 600000, 30000, 90000),
      45000,
    );
    render(<SessionReview id={store.session.id} />);
    await screen.findByText("Reorder is hard to find");
    const first = store.player.at(-1)!;
    expect(first).toMatchObject({
      videoId: uberEatsCandidates[0].id,
      startMs: 30000,
      endMs: 90000,
      clipEndMs: 90000,
      playToken: 0,
    });
    expect(screen.getByText(/By 4kEasyGuide · June 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Interaction events/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /YouTube|Original source/ })).not.toBeInTheDocument();
    const chips = screen.getAllByRole("button", { name: "00:45" });
    act(() => fireEvent.click(chips[0]!));
    expect(store.player.at(-1)).toMatchObject({ startMs: 45000, playToken: 1 });
    act(() => fireEvent.click(chips[0]!));
    expect(store.player.at(-1)).toMatchObject({ startMs: 45000, playToken: 2 });
  });
  it("offers attaching the original when the embed is blocked", async () => {
    store.session = withFinding(createPublicSession(uberEatsCandidates[1], 600000, 0, 60000), 5000);
    render(<SessionReview id={store.session.id} />);
    await screen.findByText("Reorder is hard to find");
    fireEvent.click(screen.getByRole("button", { name: "Simulate blocked embed" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Watch on YouTube.*attach the original/);
    expect(screen.getByLabelText(/Attach original video/)).toBeInTheDocument();
  });
  it("labels DoorDash footage as Explorer competitor evidence under Uber Eats", async () => {
    store.session = withFinding(
      createCompetitorSession(doorDashCandidates[0]!, "uber-eats", 600000, 0, 60000),
      5000,
    );
    render(<SessionReview id={store.session.id} />);
    await screen.findByText("Reorder is hard to find");
    const banner = screen.getByRole("complementary", { name: "Explorer competitor footage" });
    expect(banner).toHaveTextContent(/DoorDash footage/);
    expect(banner).toHaveTextContent(/never counts toward its insights/);
    expect(screen.getByText(/Competitor footage · DoorDash/)).toBeInTheDocument();
    expect(sessionStorage.getItem("loopmate-product")).toBe("uber-eats");
  });
  it("keeps archived Miso recordings out of every product", async () => {
    store.session = makeSession({ source_app: "Miso food delivery" });
    render(<SessionReview id={store.session.id} />);
    await screen.findByRole("heading", { name: "Archived recording" });
    expect(sessionStorage.getItem("loopmate-product")).toBeNull();
  });
});
