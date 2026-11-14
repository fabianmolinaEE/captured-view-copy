// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLORER_IMPORT_KEY,
  autoImportExplorerRuns,
  describeExplorerImport,
  explorerRunsFile,
  importExplorerRuns,
  pregeneratedRunLabel,
  reimportAllDemoRuns,
  resetExplorerAutoImportForTests,
} from "@/lib/research/demo/importExplorerRuns";
import {
  DEMO_IMPORT_KEY,
  SESSIONS_CHANGED_EVENT,
  importTrackerRuns,
  resetAutoImportForTests,
} from "@/lib/research/demo/importTrackerRuns";
import raw from "@/lib/research/demo/doordash-explorer-runs.json";
import {
  clearAll,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
} from "@/lib/research/sessionStorage";
import { reviewFinding } from "@/lib/research/review";
import { analysesToday } from "@/lib/research/agentSettings";
import { competitorSessionsFor, isCompetitorSession } from "@/lib/research/competitors";
import { sessionsForProduct } from "@/lib/research/products";
import { latestFindings } from "@/lib/research/insights";
import {
  listSimulatedRuns,
  resetSimulatedDemo,
  startSampleTestRun,
} from "@/lib/research/simulation";
import { resetAgentSettings, setScoutSettings } from "@/hooks/use-agent-settings";
import { selectProduct } from "@/hooks/use-product";
import { pregeneratedLabel } from "@/lib/research/publicVideo";

const pregeneratedFor = () => ({
  generated_at: "2026-11-13T10:00:00.000Z",
  note: "",
  run_ids: [],
  imported_at: "2026-11-13T10:00:00.000Z",
});

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  Link: ({
    children,
    to,
    params,
    search,
    className,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, unknown>;
    className?: string;
    onClick?: (event: React.MouseEvent) => void;
    [key: string]: unknown;
  }) => {
    const href = Object.entries(params ?? {}).reduce(
      (path, [key, value]) => path.replace(`$${key}`, value),
      to,
    );
    return (
      <a
        href={href}
        className={className}
        aria-label={props["aria-label"] as string | undefined}
        data-search={search ? JSON.stringify(search) : undefined}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
      >
        {children}
      </a>
    );
  },
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/components/research/PublicVideoPlayer", () => ({
  PublicVideoPlayer: (props: { videoId: string; startMs?: number; endMs?: number }) => (
    <div
      aria-label="Session video"
      data-video={props.videoId}
      data-start={props.startMs}
      data-end={props.endMs}
    >
      Hosted recording
    </div>
  ),
}));
import { Insights } from "@/components/research/Insights";
import { InsightDetail } from "@/components/research/InsightDetail";

const file = explorerRunsFile();
const FIRST = file.videos[0]!;

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  sessionStorage.clear();
  resetAutoImportForTests();
  resetExplorerAutoImportForTests();
  resetSimulatedDemo();
  resetAgentSettings();
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  resetSimulatedDemo();
});

describe("DoorDash Explorer run import", () => {
  it("imports 4 competitor sessions with 7 unaltered findings, all routed to experiment", async () => {
    const result = await importExplorerRuns();
    expect(result.failed).toEqual([]);
    expect(result.added).toHaveLength(4);
    expect(result.findings_added).toBe(7);
    const sessions = await listSessions();
    expect(sessions).toHaveLength(4);
    for (const video of file.videos) {
      const session = sessions.find((s) => s.id === video.session_id)!;
      expect(isCompetitorSession(session)).toBe(true);
      expect(session.source_app).toBe("DoorDash");
      expect(session.status).toBe("analyzed");
      expect(session.created_at).toBe(video.run.started_at);
      expect(session.public_video).toMatchObject({
        video_id: video.candidate_id,
        start_ms: video.clip.start_ms,
        end_ms: video.clip.end_ms,
        competitor_of: "uber-eats",
      });
      // Model output is stored verbatim.
      expect(session.runs).toEqual([video.run]);
      expect(session.findings).toEqual(video.findings);
      expect(session.pregenerated).toMatchObject({
        source: "doordash-explorer-runs",
        generated_at: raw.generated_at,
        note: raw.note,
        run_ids: [video.run.id],
      });
      expect(pregeneratedRunLabel(session)).toBe("Explorer run · pre-generated Nov 13");
    }
    expect(sessions.flatMap((s) => s.findings).every((f) => f.suggested_route === "experiment"));
    // Competitor footage never counts as Uber Eats evidence, but is listed for its Competitors tab.
    expect(sessionsForProduct(sessions, "uber-eats")).toHaveLength(0);
    expect(competitorSessionsFor(sessions, "uber-eats")).toHaveLength(4);
    expect(competitorSessionsFor(sessions, "checkout")).toHaveLength(0);
    // Pre-generated runs never count toward any scout's daily cap.
    const day = new Date(FIRST.run.started_at);
    expect(analysesToday(sessions, day)).toBe(0);
    expect(analysesToday(sessions, day, "explorer")).toBe(0);
  });

  it("is idempotent and never overwrites an edited session", async () => {
    await importExplorerRuns();
    const original = (await getSession(FIRST.session_id))!;
    const edited = reviewFinding(original, original.findings[0]!.id, {
      review_status: "accepted",
      reviewer_note: "Worth testing",
    });
    await saveSession(edited);
    await deleteSession(file.videos[1]!.session_id);
    const again = await importExplorerRuns();
    expect(again.added).toEqual([file.videos[1]!.session_id]);
    expect(again.skipped).toHaveLength(3);
    const kept = (await getSession(FIRST.session_id))!;
    expect(kept.findings[0]!.review_status).toBe("accepted");
    expect(kept.findings[0]!.reviewer_note).toBe("Worth testing");
    const third = await importExplorerRuns();
    expect(third.added).toEqual([]);
    expect(describeExplorerImport(third)).toMatch(/nothing was changed/);
  });

  it("auto-imports with its own version key, even where the Tracker import already ran", async () => {
    await importTrackerRuns();
    window.localStorage.setItem(DEMO_IMPORT_KEY, "uber-eats-tracker-runs@2026-11-13");
    const events: string[][] = [];
    const listener = (e: Event) =>
      events.push((e as CustomEvent<{ added: string[] }>).detail.added);
    window.addEventListener(SESSIONS_CHANGED_EVENT, listener);
    const result = await autoImportExplorerRuns();
    window.removeEventListener(SESSIONS_CHANGED_EVENT, listener);
    expect(result?.added).toHaveLength(4);
    expect(events.at(-1)).toHaveLength(4);
    expect(window.localStorage.getItem(EXPLORER_IMPORT_KEY)).toBeTruthy();
    expect(window.localStorage.getItem(DEMO_IMPORT_KEY)).toBe("uber-eats-tracker-runs@2026-11-13");
    resetExplorerAutoImportForTests();
    expect(await autoImportExplorerRuns()).toBeNull();
  });

  it("Settings re-import covers both Tracker and Explorer runs", async () => {
    const first = await reimportAllDemoRuns();
    expect(first.tracker.added).toHaveLength(5);
    expect(first.explorer.added).toHaveLength(4);
    expect(first.message).toMatch(/Added 5 Uber Eats Tracker runs/);
    expect(first.message).toMatch(/Added 4 DoorDash Explorer runs \(7 competitor insights\)/);
    const second = await reimportAllDemoRuns();
    expect(second.message).toMatch(/No Explorer runs were missing/);
  });
});

describe("Unified Insights with imported Tracker and Explorer runs", () => {
  it("lists 7 Explorer cards (no thumbnails) under the legacy Competitors link", async () => {
    await importExplorerRuns();
    selectProduct("uber-eats");
    const view = render(<Insights source="explorer" />);
    expect(screen.getByRole("button", { name: /^Explorer/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const sessions = await listSessions();
    const findings = sessions.flatMap((s) => latestFindings(s));
    expect(findings).toHaveLength(7);
    for (const finding of findings) {
      const card = (await screen.findByRole("heading", { name: finding.title })).closest(
        "article",
      )!;
      expect(card).toHaveAttribute("data-source", "explorer");
      expect(within(card).getByText("Explorer · DoorDash")).toBeInTheDocument();
      expect(within(card).getByText("Competitor pattern")).toBeInTheDocument();
      expect(within(card).getByText("Explorer run · pre-generated Nov 13")).toBeInTheDocument();
      expect(within(card).getByTestId("video-count")).toHaveTextContent(/^from 1 video/);
      // One stretched link covers the whole block; no nested links, no thumbnail.
      const links = within(card).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", `/insights/${finding.session_id}/${finding.id}`);
      expect(links[0]!.className).toContain("after:absolute");
      expect(within(card).queryByTestId("evidence-thumbnail")).toBeNull();
    }
    expect(view.container.querySelector("img")).toBeNull();
    // The Both sample also matches the Explorer filter, with its visible badge.
    const sample = screen.getByRole("article", { name: "Order again on the home screen" });
    expect(sample).toHaveAttribute("data-source", "both");
    expect(within(sample).getByText("Simulated demo")).toBeVisible();
  });

  it("puts the three demo insights first and filters by source and video count", async () => {
    await importTrackerRuns();
    await importExplorerRuns();
    selectProduct("uber-eats");
    const onSourceChange = vi.fn();
    render(<Insights onSourceChange={onSourceChange} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(16));
    const rows = screen.getAllByRole("article");
    expect(rows.slice(0, 3).map((row) => row.getAttribute("aria-label"))).toEqual([
      "Order again on the home screen",
      "Hidden minimum order threshold",
      "Cart Complement Recommendations",
    ]);
    expect(rows.slice(0, 3).map((row) => row.getAttribute("data-source"))).toEqual([
      "both",
      "tracker",
      "explorer",
    ]);
    expect(within(rows[0]!).getByText("Tracker + Explorer")).toBeInTheDocument();
    expect(within(rows[0]!).getByTestId("video-count")).toHaveTextContent(
      "from 16 videos · sample",
    );
    expect(within(rows[0]!).getByText("Seen in 14 of 50 sessions · sample")).toBeInTheDocument();
    expect(within(rows[0]!).getByRole("link")).toHaveAttribute(
      "href",
      "/insights/sample/order-again",
    );

    const sources = within(screen.getByRole("group", { name: "Source" }));
    fireEvent.click(sources.getByRole("button", { name: /^Tracker/ }));
    expect(onSourceChange).toHaveBeenLastCalledWith("tracker");
    expect(screen.getAllByRole("article")).toHaveLength(9);
    for (const finding of FIRST.findings)
      expect(screen.queryByRole("heading", { name: finding.title })).toBeNull();
    fireEvent.click(sources.getByRole("button", { name: /^Both/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(sources.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Videos" }), {
      target: { value: "16" },
    });
    expect(screen.getAllByRole("article").map((row) => row.getAttribute("aria-label"))).toEqual([
      "Order again on the home screen",
    ]);
  });
});

describe("Sample Order again insight", () => {
  it("shows labeled Tracker + Explorer storyboards and starts the simulated test on approve", async () => {
    selectProduct("checkout");
    const view = render(<InsightDetail sessionId="sample" findingId="order-again" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Order again on the home screen" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("loopmate-product")).toBe("uber-eats"));
    expect(screen.getAllByText("Simulated demo").length).toBeGreaterThan(0);
    expect(screen.getByText("Tracker + Explorer")).toBeInTheDocument();
    const tracker = screen.getByRole("region", { name: "Tracker evidence" });
    const explorer = screen.getByRole("region", { name: "Explorer evidence" });
    expect(within(tracker).getAllByRole("img", { name: /^Illustrative frame:/ })).toHaveLength(3);
    expect(within(explorer).getAllByRole("img", { name: /^Illustrative frame:/ })).toHaveLength(1);
    expect(screen.getByText("Illustrative storyboard · not real footage")).toBeInTheDocument();
    // No real footage is claimed: no player, no video, no highlight chips.
    expect(screen.queryByLabelText("Session video")).toBeNull();
    expect(view.container.querySelector("video, img:not(svg)")).toBeNull();
    expect(screen.queryByRole("group", { name: "Evidence highlights" })).toBeNull();

    const panel = screen.getByRole("region", { name: "Suggested test" });
    expect(within(panel).getByText("20% of users see the variant")).toBeInTheDocument();
    expect(listSimulatedRuns()).toHaveLength(0);
    fireEvent.click(within(panel).getByRole("button", { name: "Approve test" }));
    await waitFor(() =>
      expect(listSimulatedRuns()).toEqual([
        expect.objectContaining({ happy_path: true, finding_id: "order-again", simulated: true }),
      ]),
    );
    expect(
      await within(panel).findByRole("link", { name: /Follow it in A\/B Tests/ }),
    ).toHaveAttribute("href", "/ab-tests");
    expect(screen.getByText("Test approved")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Return to pending" }));
    await waitFor(() => expect(listSimulatedRuns()).toHaveLength(0));
    expect(within(panel).getByRole("button", { name: "Approve test" })).toBeInTheDocument();
  });

  it("edits the sample test on the page and rejects it without starting a run", async () => {
    selectProduct("uber-eats");
    render(<InsightDetail sessionId="sample" findingId="order-again" />);
    const panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: "Edit test" }));
    fireEvent.change(within(panel).getByRole("textbox", { name: "Primary metric" }), {
      target: { value: "orders per returning user" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Save edits" }));
    expect(within(panel).getByText("orders per returning user")).toBeInTheDocument();
    expect(
      within(panel).getByText(/The sample PR, diffs and analytics stay fixed/),
    ).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Reject test" }));
    await waitFor(() => expect(screen.getByText("Rejected")).toBeInTheDocument());
    expect(listSimulatedRuns()).toHaveLength(0);
  });

  it("approves the edited sample test into the run and links to that run", async () => {
    selectProduct("uber-eats");
    render(<InsightDetail sessionId="sample" findingId="order-again" />);
    const panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: "Edit test" }));
    fireEvent.change(within(panel).getByRole("textbox", { name: "Primary metric" }), {
      target: { value: "orders per returning user" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Save edits" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Approve test" }));
    await waitFor(() => expect(listSimulatedRuns()).toHaveLength(1));
    const run = listSimulatedRuns()[0]!;
    expect(run.test.primary_metric).toBe("orders per returning user");
    const follow = await within(panel).findByRole("link", { name: /Follow it in A\/B Tests/ });
    expect(follow).toHaveAttribute("data-search", JSON.stringify({ run: run.id }));
  });

  it("saves approval without a run when the Experimenter is off", async () => {
    act(() => setScoutSettings("experimenter", { enabled: false }));
    selectProduct("uber-eats");
    render(<InsightDetail sessionId="sample" findingId="order-again" />);
    const panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: "Approve test" }));
    expect(await within(panel).findByText(/Experimenter is off in Settings/)).toBeInTheDocument();
    expect(listSimulatedRuns()).toHaveLength(0);
  });

  it("keeps sample edits across remounts and starts the approved test once the Experimenter is on", async () => {
    act(() => setScoutSettings("experimenter", { enabled: false }));
    selectProduct("uber-eats");
    const first = render(<InsightDetail sessionId="sample" findingId="order-again" />);
    let panel = screen.getByRole("region", { name: "Suggested test" });
    fireEvent.click(within(panel).getByRole("button", { name: "Edit test" }));
    fireEvent.change(within(panel).getByRole("textbox", { name: "Primary metric" }), {
      target: { value: "orders per returning user" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Save edits" }));
    first.unmount();
    render(<InsightDetail sessionId="sample" findingId="order-again" />);
    panel = screen.getByRole("region", { name: "Suggested test" });
    expect(within(panel).getByText("orders per returning user")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Approve test" }));
    expect(await within(panel).findByText(/Experimenter is off in Settings/)).toBeInTheDocument();
    act(() => setScoutSettings("experimenter", { enabled: true }));
    fireEvent.click(await within(panel).findByRole("button", { name: "Start test" }));
    await waitFor(() =>
      expect(listSimulatedRuns()).toEqual([
        expect.objectContaining({
          happy_path: true,
          test: expect.objectContaining({ primary_metric: "orders per returning user" }),
        }),
      ]),
    );
  });

  it("shows the approved state on the Insights card", async () => {
    selectProduct("uber-eats");
    render(<Insights />);
    const card = await screen.findByRole("article", { name: "Order again on the home screen" });
    expect(within(card).getByText("Needs review")).toBeInTheDocument();
    act(() => {
      startSampleTestRun();
    });
    expect(await within(card).findByText("Test approved")).toBeInTheDocument();
  });
});

describe("Competitor insight detail", () => {
  it("opens a DoorDash insight even when another product is selected", async () => {
    await importExplorerRuns();
    selectProduct("checkout");
    const finding = FIRST.findings[0]!;
    render(
      <InsightDetail
        sessionId={FIRST.session_id}
        findingId={finding.id}
        seekMs={finding.timestamp_ms}
      />,
    );
    expect(await screen.findByRole("heading", { name: finding.title })).toBeInTheDocument();
    expect(sessionStorage.getItem("loopmate-product")).toBe("uber-eats");
    expect(screen.getByText("Explorer · DoorDash")).toBeInTheDocument();
    expect(screen.getByText("Competitor pattern")).toBeInTheDocument();
    expect(screen.queryByText(/n = 1/)).toBeNull();
    expect(screen.getByRole("heading", { name: "What Uber Eats could adopt" })).toBeInTheDocument();
    expect(
      screen.getByText("Explorer run · pre-generated Nov 13 · not counted toward today's cap"),
    ).toBeInTheDocument();
    const back = screen.getByRole("link", { name: "Insights" });
    expect(back).toHaveAttribute("href", "/insights");
    const video = screen.getByLabelText("Session video");
    expect(video).toHaveAttribute("data-video", FIRST.candidate_id);
  });

  it("opens on the card's end-time chip with that chip pressed and the full range playable", async () => {
    await importExplorerRuns();
    selectProduct("uber-eats");
    const finding = FIRST.findings.find(
      (f) => typeof f.end_timestamp_ms === "number" && f.end_timestamp_ms > f.timestamp_ms,
    )!;
    const end = finding.end_timestamp_ms!;
    render(<InsightDetail sessionId={FIRST.session_id} findingId={finding.id} seekMs={end} />);
    await screen.findByRole("heading", { name: finding.title });
    const chips = within(screen.getByRole("group", { name: "Evidence highlights" }));
    expect(chips.getAllByRole("button")).toHaveLength(2);
    expect(chips.getByRole("button", { pressed: true })).toHaveAccessibleName(
      expect.stringContaining("Play highlight at"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Play highlight" }));
    const video = screen.getByLabelText("Session video");
    expect(Number(video.getAttribute("data-start"))).toBeLessThanOrEqual(finding.timestamp_ms);
    expect(Number(video.getAttribute("data-end"))).toBeGreaterThanOrEqual(
      Math.min(end, FIRST.clip.end_ms),
    );
  });

  it("labels an Explorer run consistently even without competitor_of", () => {
    const session = { pregenerated: { ...pregeneratedFor(), source: "doordash-explorer-runs" } };
    expect(pregeneratedRunLabel(session as never)).toBe("Explorer run · pre-generated Nov 13");
    expect(pregeneratedLabel(session as never)).toBe("Explorer run · pre-generated Nov 13");
  });

  it("loads after a late Explorer import on a direct link", async () => {
    selectProduct("uber-eats");
    const finding = FIRST.findings[0]!;
    render(<InsightDetail sessionId={FIRST.session_id} findingId={finding.id} />);
    await screen.findByRole("heading", { name: "Insight unavailable" });
    await act(async () => {
      await importExplorerRuns();
    });
    expect(await screen.findByRole("heading", { name: finding.title })).toBeInTheDocument();
  });
});
