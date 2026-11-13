import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { makeSession, modelOutput } from "./research-fixtures";
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
vi.mock("@/lib/research/apiClient", () => ({
  connectionStatus: async () => ({
    configured: false,
    backend_configured: false,
    message: "Not configured.",
  }),
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  getSession: async () => store.session,
  saveSession: async (session: Session) => {
    store.saves.push(session);
    store.session = session;
  },
  deleteSession: vi.fn(),
  exportSession: vi.fn(),
  downloadFile: vi.fn(),
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
});
