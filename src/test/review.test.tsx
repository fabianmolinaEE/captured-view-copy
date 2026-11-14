import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import { makeSession, modelOutput, makeFinding, makeRun } from "./research-fixtures";
const store = vi.hoisted(() => ({
  session: undefined as Session | undefined,
  saves: [] as Session[],
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/lib/research/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/research/apiClient")>()),
  connectionStatus: async () => ({
    configured: false,
    backend_configured: false,
    message: "Not configured.",
  }),
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  listSessions: async () => (store.session ? [store.session] : []),
  getSession: async () => store.session,
  saveSession: async (session: Session) => {
    store.saves.push(session);
    store.session = session;
  },
  deleteSession: vi.fn(),
  exportSession: vi.fn(),
  downloadFile: vi.fn(),
}));
vi.mock("@/components/research/PublicVideoPlayer", () => ({
  PublicVideoPlayer: () => <div aria-label="Session recording">Hosted recording</div>,
}));
import { SessionReview } from "@/components/research/SessionReview";
beforeEach(() => {
  store.saves = [];
  store.session = makeSession();
  store.session.findings[0]!.review_status = "pending";
  store.session.runs[0]!.raw_output = modelOutput();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL() {
        return "blob:test";
      }
      static override revokeObjectURL() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.removeItem("loopmate-product");
});
describe("researcher review interface", () => {
  it("persists acceptance and fast notes without altering model output, then reloads the decision", async () => {
    const s = store.session!;
    const original = structuredClone(s.runs[0]!.raw_output);
    const view = render(<SessionReview id={s.id} />);
    await screen.findByText("Observed spinner");
    fireEvent.click(screen.getByRole("button", { name: "Accept finding" }));
    const note = screen.getByRole("textbox", { name: "Reviewer note for Observed spinner" });
    fireEvent.change(note, { target: { value: "First note" } });
    fireEvent.change(note, { target: { value: "Final interpretation" } });
    await waitFor(() =>
      expect(store.session?.findings[0]).toMatchObject({
        review_status: "accepted",
        reviewer_note: "Final interpretation",
      }),
    );
    expect(store.session?.runs[0]?.raw_output).toEqual(original);
    view.unmount();
    render(<SessionReview id={s.id} />);
    await screen.findByDisplayValue("Final interpretation");
    expect(screen.getByText("Review status: accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reject finding" }));
    await waitFor(() => expect(store.session?.findings[0]?.review_status).toBe("rejected"));
  });
  it.each(["hosted", "local"])(
    "uses the shared review layout and keeps edits for a %s Uber Eats recording",
    async (playback) => {
      const session = createPublicSession(uberEatsCandidates[0], 120000, 0, 60000);
      const run = makeRun({ mode: "public_video" });
      session.runs = [run];
      session.findings = [
        makeFinding({
          analysis_run_id: run.id,
          category: "decision_support",
          title: "Make options easier to compare",
          recommendation: "Show size and price together before adding an item.",
          expected_benefit: "Could reduce the effort of comparing options.",
          review_status: "pending",
          event_ids: [],
          evidence_sources: ["video"],
        }),
      ];
      if (playback === "local")
        session.video_blob = new Blob(["original video"], { type: "video/mp4" });
      store.session = session;
      const view = render(<SessionReview id={session.id} />);
      await screen.findByText("Make options easier to compare");
      expect(view.container.querySelector(".review-grid .video-stage")).toBeInTheDocument();
      expect(!!view.container.querySelector("video")).toBe(playback === "local");
      expect(
        screen.getByText("Show size and price together before adding an item."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Observed opportunities/ })).toBeInTheDocument();
      expect(
        screen.queryByText(/public walkthrough|Sunday|pitch|case study/i),
      ).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole("textbox", { name: /Reviewer note for/ }), {
        target: { value: "Useful design opportunity" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Accept finding" }));
      await waitFor(() =>
        expect(store.session?.findings[0]).toMatchObject({
          review_status: "accepted",
          reviewer_note: "Useful design opportunity",
        }),
      );
      expect(store.session?.public_video).toEqual(session.public_video);
      expect(store.session?.runs).toEqual(session.runs);
    },
  );
});
