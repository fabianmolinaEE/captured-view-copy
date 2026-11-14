import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectProduct } from "@/hooks/use-product";
import { importTrackerRuns } from "@/lib/research/demo/importTrackerRuns";
import { clearAll, deleteSession } from "@/lib/research/sessionStorage";

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

const VOICEOVER = "ee08bb6d-654b-487a-a9bf-05a1ad0f8a48";

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
      await screen.findByRole("link", { name: "How to Use Uber Eats for the First Time" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Total sessions").closest(".stat")).toHaveTextContent("5");
    expect(screen.getByText("AI proposals").closest(".stat")).toHaveTextContent("8");
    expect(screen.getByText("Historical UI (2020)")).toBeInTheDocument();
    expect(screen.getByText("Tracker found no insights in this clip")).toBeInTheDocument();
    expect(screen.getAllByText(/Tracker run · pre-generated Nov 13/)).toHaveLength(5);
  });

  it("session review says honestly when Tracker found nothing", async () => {
    await importTrackerRuns();
    render(<SessionReview id={VOICEOVER} />);
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
    await deleteSession(VOICEOVER);
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "Re-import Tracker and Explorer runs" }));
    expect(
      await screen.findByText(/Added 1 Uber Eats Tracker run \(0 insights\)\. 4 already present/),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Re-import Tracker and Explorer runs" }),
    );
    expect(await screen.findByText(/nothing was changed/)).toBeInTheDocument();
  });
});
