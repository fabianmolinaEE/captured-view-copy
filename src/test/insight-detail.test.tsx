import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { makeSession, modelOutput } from "./research-fixtures";
const store = vi.hoisted(() => ({
  session: undefined as Session | undefined,
  saves: [] as Session[],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  getSession: async () => store.session,
  saveSession: async (session: Session) => {
    store.saves.push(session);
    store.session = session;
  },
  exportSession: vi.fn(),
}));
import { InsightDetail } from "@/components/research/InsightDetail";
beforeEach(() => {
  store.session = makeSession();
  store.session.findings[0]!.review_status = "pending";
  store.session.runs[0]!.raw_output = modelOutput();
  store.saves = [];
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL() {
        return "blob:test";
      }
      static override revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("evidence-centered insight detail", () => {
  it("keeps quick notes and action edits through approval and remounting", async () => {
    const session = store.session!;
    const finding = session.findings[0]!;
    const original = structuredClone(session.runs[0]!.raw_output);
    const view = render(<InsightDetail sessionId={session.id} findingId={finding.id} />);
    await screen.findByRole("heading", { name: "Observed spinner" });
    expect(screen.getByRole("complementary", { name: "Finding evidence" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept finding" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Researcher note" }), {
      target: { value: "Observed repeated attempts" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Next-step title" }), {
      target: { value: "Improve loading feedback" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Proposed scope" }), {
      target: { value: "Add visible wait feedback to the details screen." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve draft" }));
    await waitFor(() =>
      expect(store.session?.findings[0]).toMatchObject({
        review_status: "accepted",
        reviewer_note: "Observed repeated attempts",
        next_step: { status: "approved", title: "Improve loading feedback" },
      }),
    );
    expect(store.session?.runs[0]?.raw_output).toEqual(original);
    view.unmount();
    render(<InsightDetail sessionId={session.id} findingId={finding.id} />);
    await screen.findByText("Draft approved");
    expect(screen.getByDisplayValue("Observed repeated attempts")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Proposed scope" }), {
      target: { value: "Narrowed scope" },
    });
    await waitFor(() => expect(store.session?.findings[0]?.next_step?.status).toBe("draft"));
  });
  it("renders safe Markdown without loading model-supplied images or raw HTML", async () => {
    const session = store.session!;
    session.findings[0]!.description =
      "**Visible wait**\n\n- Needs review\n\n![tracking](https://example.com/pixel)\n\n<script>alert(1)</script>";
    const { container } = render(
      <InsightDetail sessionId={session.id} findingId={session.findings[0]!.id} />,
    );
    await screen.findByText("Visible wait");
    expect(container.querySelector(".model-markdown strong")).toHaveTextContent("Visible wait");
    expect(container.querySelector(".model-markdown img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});
