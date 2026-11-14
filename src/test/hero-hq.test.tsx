import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";

const store = vi.hoisted(() => ({ sessions: [] as Session[] }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    onClick?: () => void;
    [key: string]: unknown;
  }) => {
    const path = Object.entries(params ?? {}).reduce(
      (href, [key, value]) => href.replace(`$${key}`, value),
      to,
    );
    const query = search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "";
    return (
      <a
        href={`${path}${query}`}
        className={props["className"] as string}
        onClick={(event) => {
          event.preventDefault();
          onClick?.();
        }}
      >
        {children}
      </a>
    );
  },
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Footer: () => null,
}));
vi.mock("@/lib/research/sessionStorage", () => ({ listSessions: async () => store.sessions }));

import { HeroHQ } from "@/components/research/HeroHQ";
import { buildSimulatedRun, SIMULATION_KEY, startSampleTestRun } from "@/lib/research/simulation";
import { FEATURED_TRACKER_FINDING_ID } from "@/lib/research/demo/happyPath";
import { selectProduct, useProduct } from "@/hooks/use-product";

const agent = (name: string) => screen.getByRole("article", { name: `${name} agent` });
const attention = () => screen.getByRole("region", { name: "Needs your attention" });
const insightLinks = () =>
  within(within(attention()).getByRole("list", { name: "Insights" })).getAllByRole("link");
const SAMPLE_TITLE = "Order again on the home screen";

function uberEatsSession(findings = 2, tokens = 500): Session {
  const run = makeRun({
    mode: "public_video",
    usage: { total_tokens: tokens },
    completed_at: new Date().toISOString(),
  });
  return makeSession({
    title: "Uber Eats walkthrough",
    source_app: "Uber Eats",
    capture_mode: "public_youtube",
    runs: [run],
    findings: Array.from({ length: findings }, (_, i) =>
      makeFinding({
        analysis_run_id: run.id,
        title: `Uber Eats finding ${i + 1}`,
        review_status: "pending",
        confidence: 0.6 + i / 10,
        suggested_route: "experiment",
        suggested_test: {
          hypothesis: "If we …, then … because …",
          change: "Variant",
          primary_metric: "time to checkout",
        },
      }),
    ),
    public_video: {
      url: "https://www.youtube.com/watch?v=EFCmkDTBYck",
      video_id: "EFCmkDTBYck",
      creator: "Creator",
      published_label: "2026",
      context: "",
      start_ms: 0,
      end_ms: 60000,
      duration_verified: true,
      footage_reviewed_at: "2026-11-13T00:00:00.000Z",
    },
  });
}

beforeEach(() => {
  store.sessions = [];
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  selectProduct(null);
});

describe("HQ", () => {
  it("leads with the labeled sample insight and four compact agent tiles, no thumbnails", async () => {
    const view = render(<HeroHQ />);
    await screen.findByText("No recordings yet");
    expect(screen.getByRole("heading", { name: "HQ", level: 1 })).toBeInTheDocument();
    const links = insightLinks();
    expect(links).toHaveLength(1);
    const sample = links[0]!;
    expect(sample).toHaveTextContent(SAMPLE_TITLE);
    expect(sample).toHaveAttribute("href", "/insights/sample/order-again");
    expect(within(sample).getByText("Simulated demo")).toBeInTheDocument();
    expect(within(sample).getByText("Tracker + Explorer")).toBeInTheDocument();
    expect(within(sample).getByTestId("video-count")).toHaveTextContent("from 16 videos · sample");
    expect(within(sample).getByText("Review insight")).toBeInTheDocument();
    // No thumbnails or posters anywhere on HQ.
    expect(view.container.querySelector("img, video, canvas")).toBeNull();
    for (const name of ["Tracker", "Explorer", "Experimenter", "Fixer"])
      expect(agent(name)).toBeInTheDocument();
    expect(within(agent("Explorer")).getByText("Standing by")).toBeInTheDocument();
    expect(within(agent("Experimenter")).getByText("Standing by")).toBeInTheDocument();
    expect(within(agent("Experimenter")).getByText("Simulated demo")).toBeInTheDocument();
    expect(within(agent("Tracker")).queryByText("Simulated demo")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Tracker analyses today" })).getByText("0 / 20"),
    ).toBeInTheDocument();
    expect(screen.getByText("None yet. Approve a test to start one.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restart demo/ })).not.toBeInTheDocument();
  });

  it("counts only real items in the header and lands Insights links on the demo product", async () => {
    render(<HeroHQ />);
    await screen.findByText("No recordings yet");
    // The fictional sample is pending, but it is not counted as a real item.
    expect(screen.getByText(/need you/)).toHaveTextContent("0 need you");
    expect(screen.getByText("+1 sample")).toBeInTheDocument();
    expect(sessionStorage.getItem("loopmate-product")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /All insights/ }));
    expect(sessionStorage.getItem("loopmate-product")).toBe("uber-eats");
  });

  it("unifies real Tracker and Explorer insights with source markers and real usage", async () => {
    const checkout = makeSession({ runs: [makeRun({ usage: { total_tokens: 1000 } })] });
    checkout.findings = [
      makeFinding({ analysis_run_id: checkout.runs[0]!.id, review_status: "pending" }),
    ];
    const uber = uberEatsSession(2, 500);
    uber.findings[0]!.id = FEATURED_TRACKER_FINDING_ID;
    const doordash = makeSession({ source_app: "DoorDash", runs: [] });
    const ddRun = makeRun({ usage: { total_tokens: 9999 } });
    doordash.runs = [ddRun];
    doordash.findings = [
      makeFinding({ analysis_run_id: ddRun.id, title: "Cart add-ons", review_status: "pending" }),
    ];
    const archived = makeSession({ source_app: "Miso food delivery" });
    store.sessions = [checkout, uber, doordash, archived];
    let product: string | null = null;
    function Probe() {
      product = useProduct().productId;
      return null;
    }
    render(
      <>
        <HeroHQ />
        <Probe />
      </>,
    );
    await screen.findByText(/Last run/);
    const links = insightLinks();
    // Featured first: the sample (Both), then the featured Tracker finding.
    expect(links[0]).toHaveTextContent(SAMPLE_TITLE);
    expect(links[1]).toHaveTextContent("Uber Eats finding 1");
    expect(links[1]).toHaveAttribute("href", `/insights/${uber.id}/${FEATURED_TRACKER_FINDING_ID}`);
    expect(within(links[1]!).getByText("from 1 video")).toBeInTheDocument();
    const explorer = links.find((link) => link.textContent?.includes("Cart add-ons"))!;
    expect(explorer.querySelector('[data-source="explorer"]')).toHaveTextContent(
      "Explorer · DoorDash",
    );
    expect(within(explorer).queryByText("Simulated demo")).not.toBeInTheDocument();
    // Archived fixtures never appear; every real card is n = 1.
    expect(links).toHaveLength(5);
    fireEvent.click(explorer);
    expect(product).toBe("uber-eats");

    expect(within(agent("Tracker")).getByText("3")).toBeInTheDocument();
    expect(within(agent("Explorer")).getByText("1")).toBeInTheDocument();
    expect(within(agent("Explorer")).getByText(/Watching DoorDash · 1 clip analyzed/));
    const byAgent = screen.getByRole("group", { name: "Tokens by agent" });
    expect(within(byAgent).getByText("1,500")).toBeInTheDocument();
    expect(within(byAgent).getByText("9,999")).toBeInTheDocument();
    const byProduct = screen.getByRole("group", { name: "Tokens by product" });
    expect(within(byProduct).getByText("10,499")).toBeInTheDocument();
    expect(within(byProduct).getByText("1,000")).toBeInTheDocument();
  });

  it("follows the approved sample test running and can restart the demo", async () => {
    startSampleTestRun(new Date(Date.now() - 5000));
    render(<HeroHQ />);
    await screen.findByText("No recordings yet");
    const card = agent("Experimenter");
    expect(within(card).getByText("Working")).toBeInTheDocument();
    expect(within(card).getByText(new RegExp(SAMPLE_TITLE))).toBeInTheDocument();
    expect(within(card).getByRole("progressbar")).toBeInTheDocument();
    expect(within(insightLinks()[0]!).getByText("Test running")).toBeInTheDocument();
    expect(screen.getByText(/of 4 agents working/)).toHaveTextContent("1 of 4 agents working");
    fireEvent.click(screen.getByRole("button", { name: /Restart demo/ }));
    expect(within(insightLinks()[0]!).getByText("Review insight")).toBeInTheDocument();
    expect(within(agent("Experimenter")).getByText("Standing by")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restart demo/ })).not.toBeInTheDocument();
  });

  it("lists simulated PRs ready to review and selects the PR's product", async () => {
    const run = buildSimulatedRun({
      kind: "fix",
      test: { hypothesis: "", change: "Bigger button", primary_metric: "" },
      finding_title: "Small button",
      session_id: null,
      finding_id: null,
      product_id: "checkout",
      started_at: new Date(Date.now() - 600000).toISOString(),
    });
    localStorage.setItem(SIMULATION_KEY, JSON.stringify({ version: 1, runs: [run] }));
    let product: string | null = null;
    function Probe() {
      product = useProduct().productId;
      return null;
    }
    render(
      <>
        <HeroHQ />
        <Probe />
      </>,
    );
    await screen.findByText("No recordings yet");
    const prs = screen.getByRole("list", { name: "PRs ready" });
    const link = within(prs).getByRole("link", { name: new RegExp(run.pr.title) });
    expect(link).toHaveAttribute("href", `/rollouts?pr=${run.id}`);
    fireEvent.click(link);
    expect(product).toBe("checkout");
  });
});
