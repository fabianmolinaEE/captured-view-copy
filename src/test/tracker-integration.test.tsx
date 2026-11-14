import "fake-indexeddb/auto";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectProduct } from "@/hooks/use-product";
import { resetAgentSettings } from "@/hooks/use-agent-settings";
import { importTrackerRuns } from "@/lib/research/demo/importTrackerRuns";
import { clearAll } from "@/lib/research/sessionStorage";

const player = vi.hoisted(() => ({ props: [] as { videoId: string; startMs?: number }[] }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  Link: ({
    children,
    to,
    params,
    search,
    className,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, unknown>;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce((href, [k, v]) => href.replace(`$${k}`, v), to)}
      className={className}
      aria-label={props["aria-label"] as string | undefined}
      data-search={search ? JSON.stringify(search) : undefined}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
  Footer: () => null,
}));
vi.mock("@/components/research/PublicVideoPlayer", () => ({
  PublicVideoPlayer: (props: { videoId: string; startMs?: number }) => {
    player.props.push(props);
    return <div aria-label="Session video">Hosted recording</div>;
  },
}));
import { Insights } from "@/components/research/Insights";
import { InsightDetail } from "@/components/research/InsightDetail";

const KEPT = "e02675ea-079d-47d7-916b-527f483be7c7";

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  sessionStorage.clear();
  resetAgentSettings();
  selectProduct("uber-eats");
  player.props = [];
});
afterEach(cleanup);

describe("Imported Uber Eats Tracker runs across the app", () => {
  it("an open Insights page refreshes to the curated pending Tracker insight beside the sample, without thumbnails", async () => {
    const view = render(<Insights />);
    await act(async () => {
      await importTrackerRuns();
    });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    const rows = screen.getAllByRole("article");
    const tracker = rows.filter((row) => row.getAttribute("data-source") === "tracker");
    expect(tracker).toHaveLength(1);
    // The labeled sample (Tracker + Explorer) is first; the featured real Tracker insight next.
    expect(rows[0]).toHaveAttribute("data-kind", "sample");
    expect(rows[1]).toHaveAccessibleName("Hidden minimum order threshold");
    expect(screen.getAllByText("Needs review", { selector: "span" })).toHaveLength(2);
    expect(screen.getAllByText("Tracker run · pre-generated Nov 13")).toHaveLength(1);
    for (const row of tracker) {
      expect(within(row).getByText(/^from 1 video/)).toBeInTheDocument();
      // Suggested tests/routes come from the model output.
      expect(within(row).getAllByText(/Fix|Experiment/).length).toBeGreaterThan(0);
      expect(within(row).getAllByRole("link")).toHaveLength(1);
    }
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("evidence-thumbnail")).toBeNull();
  });

  it("insight detail opens the YouTube player at the chip timestamp with provenance", async () => {
    await importTrackerRuns();
    const findings = (
      await import("@/lib/research/demo/uber-eats-tracker-runs.json")
    ).default.videos.find((video) => video.session_id === KEPT)!.findings;
    const finding = findings[0]!;
    render(<InsightDetail sessionId={KEPT} findingId={finding.id} seekMs={finding.timestamp_ms} />);
    expect(await screen.findByRole("heading", { name: finding.title })).toBeInTheDocument();
    expect(player.props.at(-1)).toMatchObject({
      videoId: "oDcQjVREO5w",
      startMs: finding.timestamp_ms,
    });
    expect(
      screen.getByText("Tracker run · pre-generated Nov 13 · not counted toward today's cap"),
    ).toBeInTheDocument();
  });
});
