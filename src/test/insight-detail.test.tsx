import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Session, SuggestedTest } from "@/lib/research/types";
import { createCompetitorSession, doorDashCandidates } from "@/lib/research/competitors";
import { listSimulatedRuns, resetSimulatedDemo } from "@/lib/research/simulation";
import { makeFinding, makeRun, makeSession, modelOutput } from "./research-fixtures";
import { resetAgentSettings, setScoutSettings } from "@/hooks/use-agent-settings";
const store = vi.hoisted(() => ({
  session: undefined as Session | undefined,
  saves: [] as Session[],
  player: [] as { videoId: string; startMs?: number; playToken?: number }[],
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  Link: ({
    children,
    to,
    search,
  }: {
    children: React.ReactNode;
    to: string;
    search?: Record<string, unknown>;
  }) => (
    <a href={to} data-search={search ? JSON.stringify(search) : undefined}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/research/PublicVideoPlayer", () => ({
  PublicVideoPlayer: (props: { videoId: string; startMs?: number; playToken?: number }) => {
    store.player.push(props);
    return <div aria-label="Session video">Hosted recording</div>;
  },
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

const agentTest: SuggestedTest = {
  hypothesis: "If we show progress text, then fewer users tap again because the wait is explained.",
  change: "Show a progress message under the spinner on item details.",
  primary_metric: "repeated taps while loading",
  guardrail_metric: "checkout completion",
};
beforeEach(() => {
  resetSimulatedDemo();
  sessionStorage.removeItem("loopmate-product");
  store.session = makeSession();
  store.session.findings[0]!.review_status = "pending";
  store.session.findings[0]!.suggested_test = agentTest;
  store.session.findings[0]!.suggested_route = "experiment";
  store.session.runs[0]!.raw_output = modelOutput();
  store.saves = [];
  store.player = [];
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
  sessionStorage.removeItem("loopmate-product");
  resetSimulatedDemo();
  resetAgentSettings();
});
const open = async (session = store.session!, seekMs?: number) => {
  const view = render(
    <InsightDetail sessionId={session.id} findingId={session.findings[0]!.id} seekMs={seekMs} />,
  );
  await screen.findByRole("heading", { name: session.findings[0]!.title });
  return view;
};

describe("evidence-centered insight detail", () => {
  it("keeps quick notes through remounting and shows legacy drafts read-only", async () => {
    const session = store.session!;
    session.findings[0]!.next_step = {
      title: "Improve loading feedback",
      scope: "Add visible wait feedback to the details screen.",
      status: "approved",
      updated_at: "2026-11-11T00:00:00.000Z",
    };
    const original = structuredClone(session.runs[0]!.raw_output);
    const view = await open();
    expect(screen.getByRole("complementary", { name: "Finding evidence" })).toBeInTheDocument();
    expect(document.querySelector('[data-source="tracker"]')).toHaveTextContent("Tracker");
    expect(screen.getByTestId("video-count")).toHaveTextContent(/^from 1 video/);
    expect(screen.getByTestId("video-count")).toHaveAttribute(
      "title",
      expect.stringContaining("Single-session observation (n = 1)"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept insight" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Researcher note" }), {
      target: { value: "Observed repeated attempts" },
    });
    await waitFor(() =>
      expect(store.session?.findings[0]).toMatchObject({
        review_status: "accepted",
        reviewer_note: "Observed repeated attempts",
      }),
    );
    const legacy = screen.getByRole("region", { name: "Earlier research draft" });
    expect(within(legacy).getByText("Improve loading feedback")).toBeInTheDocument();
    expect(within(legacy).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(legacy).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Next-step title" })).not.toBeInTheDocument();
    expect(store.session?.runs[0]?.raw_output).toEqual(original);
    view.unmount();
    await open();
    expect(screen.getByDisplayValue("Observed repeated attempts")).toBeInTheDocument();
  });

  it("accepts the insight and approves its test in one write, starting a labeled simulated run", async () => {
    await open();
    const panel = screen.getByRole("region", { name: "Suggested test" });
    expect(within(panel).getByText("Agent suggestion")).toBeInTheDocument();
    expect(within(panel).getByText(agentTest.hypothesis)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Approve test" })).toBeDisabled();
    const saves = store.saves.length;
    fireEvent.click(within(panel).getByRole("button", { name: "Accept insight & approve test" }));
    await waitFor(() =>
      expect(store.session?.findings[0]).toMatchObject({
        review_status: "accepted",
        test_decision: { decision: "approved" },
      }),
    );
    expect(store.saves.length).toBe(saves + 1);
    expect(store.session?.findings[0]?.suggested_test).toEqual(agentTest);
    await within(panel).findByRole("link", { name: /Follow it in A\/B Tests/ });
    expect(within(panel).getAllByText("Simulated demo").length).toBeGreaterThan(0);
    const runs = listSimulatedRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ kind: "experiment", simulated: true, test: agentTest });
  });

  it("saves the approval but starts no simulated run while the Experimenter is turned off", async () => {
    setScoutSettings("experimenter", { enabled: false });
    await open();
    const panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: "Accept insight & approve test" }));
    await waitFor(() =>
      expect(store.session?.findings[0]).toMatchObject({
        review_status: "accepted",
        test_decision: { decision: "approved" },
      }),
    );
    expect(
      await within(panel).findByText(/Experimenter is turned off in Settings/),
    ).toBeInTheDocument();
    expect(listSimulatedRuns()).toHaveLength(0);
  });

  it("keeps the agent original when the reviewer edits, and edits after approval return to pending", async () => {
    store.session!.findings[0]!.review_status = "accepted";
    await open();
    const panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: "Approve test" }));
    await waitFor(() =>
      expect(store.session?.findings[0]?.test_decision?.decision).toBe("approved"),
    );
    fireEvent.click(within(panel).getByRole("button", { name: "Edit test" }));
    fireEvent.change(within(panel).getByRole("textbox", { name: "Primary metric" }), {
      target: { value: "taps before the item loads" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Save edits" }));
    await waitFor(() =>
      expect(store.session?.findings[0]?.test_decision).toMatchObject({
        decision: "pending",
        edited: true,
        edited_test: { primary_metric: "taps before the item loads" },
      }),
    );
    expect(store.session?.findings[0]?.suggested_test).toEqual(agentTest);
    expect(within(panel).getByText("Edited by reviewer")).toBeInTheDocument();
    expect(listSimulatedRuns()).toHaveLength(0);
    fireEvent.click(within(panel).getByRole("button", { name: "Revert to agent suggestion" }));
    await waitFor(() => expect(store.session?.findings[0]?.test_decision?.edited).toBe(false));
    expect(within(panel).getByText("Agent suggestion")).toBeInTheDocument();
  });

  it("routes to the Fixer, links to Rollouts and withdraws the simulated run when the insight is rejected", async () => {
    store.session!.findings[0]!.review_status = "accepted";
    await open();
    const panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: /Fix directly/ }));
    await waitFor(() =>
      expect(store.session?.findings[0]?.test_decision?.route_override).toBe("fix"),
    );
    expect(within(panel).getByText("Agent suggested: Run an A/B test")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Approve fix" }));
    await within(panel).findByRole("link", { name: /See the fix in Rollouts/ });
    expect(listSimulatedRuns()[0]).toMatchObject({ kind: "fix", scout: "fixer" });
    fireEvent.click(screen.getByRole("button", { name: "Reject insight" }));
    await waitFor(() =>
      expect(store.session?.findings[0]).toMatchObject({
        review_status: "rejected",
        test_decision: { decision: "pending" },
      }),
    );
    await waitFor(() => expect(listSimulatedRuns()).toHaveLength(0));
  });

  it("blocks approval of an experiment without a primary metric", async () => {
    store.session!.findings[0]!.suggested_test = { ...agentTest, primary_metric: " " };
    await open();
    const panel = screen.getByRole("region", { name: "Suggested test" });
    expect(
      within(panel).getByRole("button", { name: "Accept insight & approve test" }),
    ).toBeDisabled();
    expect(store.saves).toHaveLength(0);
  });

  it("opens local video at a highlight timestamp and plays highlight chips", async () => {
    const view = await open(store.session!, 1000);
    const chips = screen.getByRole("group", { name: "Evidence highlights" });
    const chip = within(chips).getByRole("button", { name: "Play highlight at 00:01" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(view.container.querySelector("video")).toBeInTheDocument();
  });

  it("seeks the hosted player from highlight chips for public competitor footage", async () => {
    const session = createCompetitorSession(doorDashCandidates[0]!, "uber-eats", 120000, 0, 60000);
    const run = makeRun({ mode: "public_video" });
    session.runs = [run];
    session.findings = [
      makeFinding({
        session_id: session.id,
        analysis_run_id: run.id,
        category: "missing_context",
        title: "Reorder sits on the home screen",
        timestamp_ms: 12000,
        review_status: "pending",
        event_ids: [],
        evidence_sources: ["video"],
      }),
    ];
    store.session = session;
    await open(session, 12000);
    expect(screen.getByText("Explorer · DoorDash")).toBeInTheDocument();
    expect(screen.getByText("Competitor public video")).toBeInTheDocument();
    expect(sessionStorage.getItem("loopmate-product")).toBe("uber-eats");
    expect(store.player.at(-1)).toMatchObject({ videoId: session.public_video!.video_id });
    expect(store.player.at(-1)?.startMs).toBe(12000);
    fireEvent.click(screen.getByRole("button", { name: "Play highlight at 00:12" }));
    await waitFor(() => expect(store.player.at(-1)?.playToken).toBe(1));
    expect(store.player.at(-1)?.startMs).toBe(10000);
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
