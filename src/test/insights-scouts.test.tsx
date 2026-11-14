import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectProduct } from "@/hooks/use-product";
import { resetAgentSettings, setScoutSettings } from "@/hooks/use-agent-settings";
import { createCompetitorSession, doorDashCandidates } from "@/lib/research/competitors";
import { resetSimulatedDemo } from "@/lib/research/simulation";
import type { Session } from "@/lib/research/types";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";

const store = vi.hoisted(() => ({ sessions: [] as Session[] }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    className,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search?: Record<string, unknown>;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a
      href={to}
      className={className}
      aria-label={props["aria-label"] as string | undefined}
      data-search={search ? JSON.stringify(search) : undefined}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  listSessions: async () => store.sessions,
}));
import { Insights } from "@/components/research/Insights";

function bagSession() {
  const session = makeSession({ title: "Bag session" });
  const run = session.runs[0]!;
  session.findings = [
    makeFinding({
      session_id: session.id,
      analysis_run_id: run.id,
      title: "Spinner hides progress",
      confidence: 0.9,
      review_status: "pending",
      suggested_route: "experiment",
      suggested_test: {
        hypothesis: "If we explain the wait, then fewer users tap again.",
        change: "Add progress text under the spinner.",
        primary_metric: "repeated taps while loading",
      },
    }),
    makeFinding({
      session_id: session.id,
      analysis_run_id: run.id,
      title: "Add button is too small",
      category: "missed_button",
      timestamp_ms: 3000,
      confidence: 0.5,
      review_status: "accepted",
      suggested_route: "fix",
      suggested_test: {
        hypothesis: "Users add the item on the first tap.",
        change: "Make the add button full width.",
        primary_metric: "missed taps",
      },
      test_decision: { decision: "approved", edited: false },
    }),
  ];
  return session;
}
function doorDashSession(analyzed: boolean) {
  const session = createCompetitorSession(doorDashCandidates[0]!, "uber-eats", 120000, 0, 60000);
  if (!analyzed) return session;
  const run = makeRun({ mode: "public_video" });
  session.runs = [run];
  session.findings = [
    makeFinding({
      session_id: session.id,
      analysis_run_id: run.id,
      title: "Recent orders sit on the home screen",
      category: "missing_context",
      timestamp_ms: 12000,
      event_ids: [],
      evidence_sources: ["video"],
      review_status: "pending",
    }),
  ];
  return session;
}

beforeEach(() => {
  resetAgentSettings();
  resetSimulatedDemo();
  selectProduct("checkout");
  store.sessions = [bagSession()];
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  resetAgentSettings();
  resetSimulatedDemo();
});

const card = (title: string) => screen.getByRole("article", { name: title });
const group = (name: "Source" | "Status") => screen.getByRole("group", { name });

describe("Unified Insights (Tracker blocks)", () => {
  it("shows one block per insight with source marker, video count, route, test and decision", async () => {
    const view = render(<Insights />);
    await screen.findByRole("heading", { name: "Spinner hides progress" });
    const spinner = card("Spinner hides progress");
    expect(spinner).toHaveAttribute("data-source", "tracker");
    expect(spinner).toHaveAttribute("data-kind", "real");
    expect(within(spinner).getByText("Tracker")).toBeInTheDocument();
    const tracker = within(spinner).getByRole("img", { name: "Found by Tracker" });
    expect(tracker.querySelectorAll("[data-scout]")).toHaveLength(1);
    expect(tracker.querySelector('[data-scout="tracker"]')).not.toBeNull();
    expect(within(spinner).getByTestId("video-count")).toHaveTextContent(/^from 1 video/);
    expect(within(spinner).getByText(/Experiment → Experimenter/)).toBeInTheDocument();
    expect(within(spinner).getByText("Add progress text under the spinner.")).toBeInTheDocument();
    expect(within(spinner).getByText("Needs review")).toBeInTheDocument();
    // The whole block is one link to the detail page.
    const links = within(spinner).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toContain("/insights/");
    const fix = card("Add button is too small");
    expect(within(fix).getByText(/Fix → Fixer/)).toBeInTheDocument();
    expect(within(fix).getByText("Fix approved")).toBeInTheDocument();
    // No thumbnails, posters or video in the list.
    expect(view.container.querySelector("img, video, canvas")).toBeNull();
    expect(screen.queryByTestId("evidence-thumbnail")).toBeNull();
    // Bag Checkout App has no competitor and no sample.
    expect(
      view.container.querySelector('[data-source="explorer"], [data-kind="sample"]'),
    ).toBeNull();
  });

  it("puts Tracker and Explorer in the header and on the source chips as little heroes", async () => {
    render(<Insights />);
    await screen.findByRole("heading", { name: "Spinner hides progress" });
    const header = screen.getByTestId("insights-heroes");
    expect(within(header).getByRole("img", { name: "Tracker, the blue scout" })).toHaveAttribute(
      "data-animated",
      "true",
    );
    expect(within(header).getByRole("img", { name: "Explorer, the green scout" })).toBeVisible();
    expect(
      screen.getByText((_, el) =>
        el?.tagName === "P"
          ? el.textContent === "Tracker watches your product. Explorer watches competitors."
          : false,
      ),
    ).toBeInTheDocument();
    const chips = group("Source");
    const scoutsIn = (name: RegExp) =>
      [...within(chips).getByRole("button", { name }).querySelectorAll("[data-scout]")].map((el) =>
        el.getAttribute("data-scout"),
      );
    expect(scoutsIn(/^All/)).toEqual([]);
    expect(scoutsIn(/^Tracker/)).toEqual(["tracker"]);
    expect(scoutsIn(/^Explorer/)).toEqual(["explorer"]);
    expect(scoutsIn(/^Both/)).toEqual(["tracker", "explorer"]);
    // Chip avatars are decorative: the button names stay "Tracker 2" etc.
    expect(within(chips).getByRole("button", { name: "Tracker 2" })).toBeInTheDocument();
  });

  it("filters by status and source, with a clear-filters escape hatch", async () => {
    render(<Insights />);
    await screen.findByRole("heading", { name: "Spinner hides progress" });
    fireEvent.click(within(group("Status")).getByRole("button", { name: "Needs you" }));
    expect(screen.getByRole("heading", { name: "Spinner hides progress" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add button is too small" })).toBeNull();
    fireEvent.click(within(group("Status")).getByRole("button", { name: "Accepted" }));
    expect(screen.queryByRole("heading", { name: "Spinner hides progress" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Add button is too small" })).toBeInTheDocument();
    fireEvent.click(within(group("Status")).getByRole("button", { name: "All" }));
    fireEvent.click(within(group("Source")).getByRole("button", { name: /^Explorer/ }));
    expect(screen.getByRole("heading", { name: "No insights match these filters." })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("heading", { name: "Spinner hides progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add button is too small" })).toBeInTheDocument();
  });

  it("hides insights below the Tracker confidence threshold behind a toggle", async () => {
    act(() => setScoutSettings("tracker", { min_confidence: 0.7 }));
    render(<Insights />);
    await screen.findByRole("heading", { name: "Spinner hides progress" });
    expect(screen.queryByRole("heading", { name: "Add button is too small" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 below threshold" }));
    expect(
      within(card("Add button is too small")).getByText("Below confidence threshold"),
    ).toBeInTheDocument();
  });
});

describe("Unified Insights (Tracker + Explorer)", () => {
  it("shows the labeled sample for Uber Eats while DoorDash footage is unanalyzed", async () => {
    selectProduct("uber-eats");
    store.sessions = [doorDashSession(false)];
    render(<Insights />);
    const sample = await screen.findByRole("article", { name: "Order again on the home screen" });
    expect(sample).toHaveAttribute("data-source", "both");
    expect(sample).toHaveAttribute("data-kind", "sample");
    expect(within(sample).getByText("Simulated demo")).toBeVisible();
    expect(within(sample).getByText("Tracker + Explorer")).toBeInTheDocument();
    const both = within(sample).getByRole("img", { name: "Found by Tracker and Explorer" });
    expect(
      [...both.querySelectorAll("[data-scout]")].map((el) => el.getAttribute("data-scout")),
    ).toEqual(["tracker", "explorer"]);
    expect(within(sample).getByTestId("video-count")).toHaveTextContent(/from 16 videos · sample/);
    expect(within(sample).getByText("Seen in 14 of 50 sessions · sample")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("lists own and DoorDash insights together, tagged by source, and filters by source", async () => {
    selectProduct("uber-eats");
    const own = makeSession({ title: "Uber Eats session", source_app: "Uber Eats" });
    own.findings[0]!.title = "Uber Eats own finding";
    store.sessions = [own, doorDashSession(true)];
    const onSourceChange = vi.fn();
    const view = render(<Insights onSourceChange={onSourceChange} />);
    const competitor = (
      await screen.findByRole("heading", { name: "Recent orders sit on the home screen" })
    ).closest("article")!;
    expect(competitor).toHaveAttribute("data-source", "explorer");
    expect(within(competitor).getByText("Explorer · DoorDash")).toBeInTheDocument();
    expect(
      within(competitor)
        .getByRole("img", { name: "Found by Explorer, watching DoorDash" })
        .querySelector('[data-scout="explorer"]'),
    ).not.toBeNull();
    expect(within(competitor).getByText("Competitor pattern")).toBeInTheDocument();
    expect(card("Uber Eats own finding")).toHaveAttribute("data-source", "tracker");
    expect(card("Order again on the home screen")).toHaveAttribute("data-source", "both");
    // The labeled sample (Both) comes first in the demo order.
    expect(screen.getAllByRole("article")[0]).toHaveAttribute("data-kind", "sample");

    fireEvent.click(within(group("Source")).getByRole("button", { name: /^Tracker/ }));
    expect(onSourceChange).toHaveBeenCalledWith("tracker");
    expect(screen.getByRole("heading", { name: "Uber Eats own finding" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recent orders sit on the home screen" }),
    ).toBeNull();
    expect(card("Order again on the home screen")).toBeInTheDocument();

    view.rerender(<Insights source="explorer" onSourceChange={onSourceChange} />);
    expect(
      screen.getByRole("heading", { name: "Recent orders sit on the home screen" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Uber Eats own finding" })).toBeNull();

    view.rerender(<Insights source="both" onSourceChange={onSourceChange} />);
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Order again on the home screen",
    ]);
  });

  it("filters by minimum video count", async () => {
    selectProduct("uber-eats");
    store.sessions = [doorDashSession(true)];
    render(<Insights />);
    await screen.findByRole("heading", { name: "Recent orders sit on the home screen" });
    const videos = screen.getByRole("combobox", { name: "Videos" });
    fireEvent.change(videos, { target: { value: "16" } });
    expect(
      screen.queryByRole("heading", { name: "Recent orders sit on the home screen" }),
    ).toBeNull();
    expect(card("Order again on the home screen")).toBeInTheDocument();
  });
});
