import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectProduct } from "@/hooks/use-product";
import {
  buildTrackerSession,
  importTrackerRuns,
  trackerRunsFile,
} from "@/lib/research/demo/importTrackerRuns";
import { clearAll, deleteSession, saveSession } from "@/lib/research/sessionStorage";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {action}
    </header>
  ),
  Footer: () => null,
}));
vi.mock("@/components/research/UberEatsSources", () => ({ PublicSourceLibrary: () => null }));
vi.mock("@/components/research/AnalysisPanel", () => ({ AnalysisPanel: () => null }));
vi.mock("@/components/research/SharedSessionPanel", () => ({ SharedSessionPanel: () => null }));
vi.mock("@/components/research/PublicVideoPlayer", () => ({ PublicVideoPlayer: () => null }));
vi.mock("@/lib/research/apiClient", () => ({
  connectionStatus: async () => ({ configured: false, message: "Not configured" }),
  saveAccessCode: vi.fn(),
}));
import { Sessions } from "@/components/research/Sessions";
import { SessionReview } from "@/components/research/SessionReview";
import { Settings } from "@/components/research/Settings";

const KEPT = "e02675ea-079d-47d7-916b-527f483be7c7";

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  sessionStorage.clear();
  selectProduct("uber-eats");
});
afterEach(cleanup);

describe("Tracker runs in the app", () => {
  it("an already-mounted Recordings list refreshes when the import finishes", async () => {
    render(<Sessions />);
    await screen.findByText("Every hero needs an origin story.");
    await act(async () => {
      await importTrackerRuns();
    });
    expect(
      await screen.findByRole("link", {
        name: "Uber Eats: how to order food (Russian-language tutorial)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Total sessions").closest(".stat")).toHaveTextContent("1");
    expect(screen.getByText("AI proposals").closest(".stat")).toHaveTextContent("1");
    expect(screen.getAllByText(/Tracker run · pre-generated Nov 13/)).toHaveLength(1);
  });

  it("session review says honestly when Tracker found nothing", async () => {
    // A completed pre-generated run with zero findings (shape of a no-insight clip).
    const video = trackerRunsFile().videos[0]!;
    await saveSession(buildTrackerSession({ ...video, findings: [] } as never));
    render(<SessionReview id={KEPT} />);
    expect(
      await screen.findByRole("heading", { name: "Tracker found no insights in this clip" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Recording notes")).getByText(
        "Tracker found no insights in this clip",
      ),
    ).toBeInTheDocument();
  });

  it("Settings re-import adds only missing runs and reports the result", async () => {
    await importTrackerRuns();
    await deleteSession(KEPT);
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "Re-import Tracker and Explorer runs" }));
    expect(
      await screen.findByText(/Added 1 Uber Eats Tracker run \(1 insight\)\./),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Re-import Tracker and Explorer runs" }),
    );
    expect(await screen.findByText(/nothing was changed/)).toBeInTheDocument();
  });
});
