import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Finding, Session } from "@/lib/research/types";
import { makeFinding, makeRun, makeSession } from "./research-fixtures";

const store = vi.hoisted(() => ({
  sessions: [] as Session[],
  search: {} as Record<string, string>,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => store.search,
  Link: ({
    children,
    to,
    params,
    search,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    className?: string;
  }) => {
    const path = Object.entries(params ?? {}).reduce((h, [k, v]) => h.replace(`$${k}`, v), to);
    const query = new URLSearchParams(search ?? {}).toString();
    return (
      <a href={query ? `${path}?${query}` : path} className={className}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  listSessions: async () => store.sessions,
}));

import { ABTests } from "@/components/research/ABTests";
import { Rollouts } from "@/components/research/Rollouts";
import { selectProduct, useProduct } from "@/hooks/use-product";
import {
  EXPERIMENT_DURATION_MS,
  listSimulatedRuns,
  readSimulationStore,
  resetSimulatedDemo,
  seedSampleLoop,
  startSampleTestRun,
  startSimulatedRun,
} from "@/lib/research/simulation";

const test = {
  hypothesis: "If we enlarge the add button, then fewer taps miss because the target is bigger.",
  change: "Full-width add button on item details.",
  primary_metric: "missed taps before adding",
};
function withFindings(patches: Partial<Finding>[]) {
  const run = makeRun();
  const session = makeSession({ runs: [run], findings: [] });
  session.findings = patches.map((patch) =>
    makeFinding({ analysis_run_id: run.id, session_id: session.id, ...patch }),
  );
  return session;
}
/** Every simulated card shows the visible "Simulated demo" text, not only a tooltip. */
function expectAllSimulatedCardsBadged() {
  const cards = document.querySelectorAll("article[data-simulated='true']");
  expect(cards.length).toBeGreaterThan(0);
  cards.forEach((card) =>
    expect(within(card as HTMLElement).getAllByText("Simulated demo").length).toBeGreaterThan(0),
  );
}
/** Happy-path run that already reached "PR ready". */
const finishedHappyPath = () =>
  startSampleTestRun(new Date(Date.now() - EXPERIMENT_DURATION_MS - 1000));
function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  resetSimulatedDemo();
  store.sessions = [];
  store.search = {};
  setReducedMotion(false);
  selectProduct("uber-eats");
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  vi.useRealTimers();
});

describe("A/B Tests", () => {
  it("starts empty, offers the sample insight and loads a labeled sample loop", async () => {
    render(<ABTests />);
    expect(await screen.findByText("No experiments yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A/B Tests", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/suggested tests to review/).closest("a")).toHaveAttribute(
      "href",
      "/insights",
    );
    const suggested = screen.getByText("Suggested: Order again on the home screen").closest("a")!;
    expect(suggested).toHaveAttribute("href", "/insights/sample/order-again");
    expect(within(suggested).getByText("Simulated demo")).toBeInTheDocument();
    expect(within(suggested).getByText("Tracker + Explorer")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Load sample loop/ })[0]!);
    const card = await screen.findByRole("article", {
      name: /Simulated experiment: Sample: delivery fee on store cards/,
    });
    expect(within(card).getAllByText(/delivery fee/).length).toBeGreaterThan(0);
    expect(within(card).getByText("Illustrative, not measured")).toBeInTheDocument();
    expect(within(card).getByText(/DoorDash public footage \(sample\)/)).toBeInTheDocument();
    expect(within(card).getByText("Sample loop · no linked insight")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /80% control, 20% variant/ })).toBeInTheDocument();
    const run = listSimulatedRuns().find((r) => r.kind === "experiment")!;
    expect(within(card).getByRole("link", { name: /Review PR/ })).toHaveAttribute(
      "href",
      `/rollouts?pr=${run.id}`,
    );
    // Only experiments are listed on A/B Tests; the sample fix belongs to Rollouts.
    expect(screen.queryByText(/quantity stepper/)).not.toBeInTheDocument();
    expectAllSimulatedCardsBadged();
  });

  it("counts real pending tests, lists rejected tests and starts approved runs", async () => {
    store.sessions = [
      {
        ...withFindings([
          { title: "Pending experiment", review_status: "pending", suggested_test: test },
          {
            title: "Pending fix",
            review_status: "pending",
            suggested_test: test,
            suggested_route: "fix",
          },
          {
            title: "Rejected idea",
            suggested_test: test,
            test_decision: { decision: "rejected", edited: false },
          },
          {
            title: "Approved experiment",
            suggested_test: test,
            suggested_route: "experiment",
            test_decision: { decision: "approved", edited: false },
          },
        ]),
        source_app: "Uber Eats",
      },
    ];
    render(<ABTests />);
    // The fix suggestion belongs to the Fixer and the sample is never counted.
    expect(await screen.findByText(/suggested test to review/)).toBeInTheDocument();
    const rejected = screen.getByText("Rejected idea").closest("li")!;
    expect(within(rejected).getByRole("link", { name: /Reconsider/ })).toBeTruthy();
    expect(listSimulatedRuns()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Start test/ }));
    const card = await screen.findByRole("article", {
      name: "Simulated experiment: Approved experiment",
    });
    expect(within(card).getByText(/Stage 1 of 7/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Source insight/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/insights\/[^/]+\/[^/]+$/),
    );
    expect(screen.queryByRole("button", { name: /Start test/ })).not.toBeInTheDocument();
    expect(listSimulatedRuns()).toHaveLength(1);
  });

  it("shows the live stage and holds deltas until the compare stage", async () => {
    const finding = makeFinding({ title: "Mid-run", suggested_test: test });
    startSimulatedRun(finding, "experiment", {
      product_id: "uber-eats",
      now: new Date(Date.now() - 12000),
    });
    render(<ABTests />);
    const card = await screen.findByRole("article", { name: "Simulated experiment: Mid-run" });
    expect(
      within(card).getByText("Collecting variant recordings (20% traffic)", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(card.querySelector("[aria-current='step']")?.textContent).toMatch(
      /Collecting variant recordings/,
    );
    expect(within(card).queryByText("Illustrative, not measured")).not.toBeInTheDocument();
    expect(within(card).getByText(/Deltas appear/)).toBeInTheDocument();
    expect(
      within(card).getByRole("list", { name: /Variant recordings \(simulated\)/ }),
    ).toBeTruthy();
    expect(within(card).queryByRole("link", { name: /Review PR/ })).not.toBeInTheDocument();
    expectAllSimulatedCardsBadged();
  });

  it("follows the approved happy-path test and hides the sample suggestion", async () => {
    const run = startSampleTestRun(new Date(Date.now() - 5000));
    store.search = { run: run.id };
    render(<ABTests />);
    const card = await screen.findByRole("article", {
      name: "Simulated experiment: Order again on the home screen",
    });
    expect(within(card).getByText("Running")).toBeInTheDocument();
    expect(within(card).getByText("Building variant", { selector: "strong" })).toBeTruthy();
    expect(within(card).getByText("Tracker + Explorer")).toBeInTheDocument();
    expect(within(card).getByText(/Primary: reorders per user/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Source insight/ })).toHaveAttribute(
      "href",
      "/insights/sample/order-again",
    );
    expect(screen.queryByText(/Suggested: Order again/)).not.toBeInTheDocument();
    expectAllSimulatedCardsBadged();
  });

  it("adopts a deep-linked run's product", async () => {
    selectProduct("checkout");
    const run = startSampleTestRun();
    store.search = { run: run.id };
    let product: string | null = null;
    function Probe() {
      product = useProduct().productId;
      return null;
    }
    render(
      <>
        <ABTests />
        <Probe />
      </>,
    );
    expect(
      await screen.findByRole("article", { name: /Order again on the home screen/ }),
    ).toBeInTheDocument();
    expect(product).toBe("uber-eats");
  });

  it("scopes runs to the selected product", async () => {
    seedSampleLoop("checkout");
    render(<ABTests />);
    expect(await screen.findByText("No experiments yet")).toBeInTheDocument();
    act(() => selectProduct("checkout"));
    expect(
      await screen.findByRole("article", { name: /delivery estimate on the review screen/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Suggested: Order again/)).not.toBeInTheDocument();
  });
});

describe("Rollouts", () => {
  it("shows an empty state with a sample loader", async () => {
    render(<Rollouts />);
    expect(screen.getByRole("heading", { name: "Rollouts", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("No pull requests yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Load sample loop/ }));
    expect(await screen.findAllByRole("article", { name: /Simulated PR:/ })).toHaveLength(2);
    expectAllSimulatedCardsBadged();
  });

  it("attributes PRs to their scout and merges or closes only the simulated record", async () => {
    seedSampleLoop("uber-eats");
    render(<Rollouts />);
    const experiment = await screen.findByRole("article", { name: /Simulated PR: Experiment:/ });
    expect(within(experiment).getByText("Drafted by Experimenter")).toBeInTheDocument();
    const fix = screen.getByRole("article", { name: /Simulated PR: Fix:/ });
    expect(within(fix).getByText("Drafted by Fixer")).toBeInTheDocument();
    expect(within(fix).getByText("Merged")).toBeInTheDocument();
    expect(within(fix).getByRole("button", { name: /View PR/ })).toBeInTheDocument();
    fireEvent.click(within(experiment).getByRole("button", { name: /Review PR/ }));
    const review = within(experiment).getByRole("region", { name: /PR review/ });
    expect(within(review).getByRole("tab", { name: /Files changed/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(within(review).getByRole("tab", { name: "Insight" }));
    expect(within(review).getByText("Sample loop · no linked insight")).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Merge" }));
    expect(await within(experiment).findAllByText("Merged")).not.toHaveLength(0);
    expect(listSimulatedRuns().every((run) => run.pr.status === "merged")).toBe(true);
  });

  it("opens the happy-path PR with diffs, analytics, deltas and the linked insight", async () => {
    const run = finishedHappyPath();
    seedSampleLoop("uber-eats");
    render(<Rollouts />);
    const article = await screen.findByRole("article", {
      name: /Simulated PR: Experiment: "Order again" on the home screen/,
    });
    // Happy path is listed first and opened by default.
    expect(screen.getAllByRole("article", { name: /Simulated PR:/ })[0]).toBe(article);
    expect(within(article).getByText("Tracker + Explorer")).toBeInTheDocument();
    const review = within(article).getByRole("region", { name: /PR review/ });
    expect(within(review).getByText(/3\/3 checks passed/)).toBeInTheDocument();
    expect(within(review).getByText("Illustrative")).toBeInTheDocument();

    // Files changed: unified diff with +/- lines and a file filter.
    const files = within(review).getByRole("navigation", { name: "Changed files" });
    expect(within(review).getByRole("region", { name: /Diff: .*HomeScreen\.tsx/ })).toBeTruthy();
    expect(review.querySelectorAll("tr[data-line='add']").length).toBeGreaterThan(0);
    expect(review.querySelectorAll("tr[data-line='del']").length).toBeGreaterThan(0);
    fireEvent.click(within(files).getByRole("button", { name: /OrderAgainRail\.tsx/ }));
    expect(within(review).getAllByRole("region", { name: /^Diff:/ })).toHaveLength(1);
    expect(
      within(review).getByRole("region", { name: /Diff: .*OrderAgainRail\.tsx/ }),
    ).toBeTruthy();

    fireEvent.click(within(review).getByRole("tab", { name: "Analytics" }));
    expect(within(review).getByText("4,120 users")).toBeInTheDocument();
    expect(within(review).getByText("14 days (simulated)")).toBeInTheDocument();
    expect(within(review).getByText("Reorders per user")).toBeInTheDocument();
    expect(within(review).getByText("Illustrative, not measured")).toBeInTheDocument();

    fireEvent.click(within(review).getByRole("tab", { name: "Deltas" }));
    expect(within(review).getByText("+45%")).toBeInTheDocument();
    expect(within(review).getByText("0.42 → 0.61")).toBeInTheDocument();

    fireEvent.click(within(review).getByRole("tab", { name: "Insight" }));
    expect(within(review).getByRole("link", { name: /Source insight/ })).toHaveAttribute(
      "href",
      "/insights/sample/order-again",
    );
    expect(within(review).getByText(/Idea from/)).toBeInTheDocument();
    expect(run.pr.status).toBe("open");
    expectAllSimulatedCardsBadged();
  });

  it("merges with a flying Experimenter when motion is allowed", async () => {
    finishedHappyPath();
    render(<Rollouts />);
    const article = await screen.findByRole("article", { name: /Order again/ });
    vi.useFakeTimers();
    fireEvent.click(within(article).getByRole("button", { name: "Merge" }));
    expect(document.body.querySelector("[data-testid='merge-flight']")).not.toBeNull();
    expect(within(article).getByRole("status")).toHaveTextContent(/PR merged/);
    expect(within(article).getByRole("status")).toHaveAttribute("data-celebration", "fly");
    expect(within(article).queryByRole("button", { name: "Merge" })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(document.body.querySelector("[data-testid='merge-flight']")).toBeNull();
    expect(within(article).getAllByText("Merged").length).toBeGreaterThan(0);
    expect(readSimulationStore().runs[0]!.pr.merged_at).toBeTruthy();
  });

  it("shows a static confirmation instead of the flight with reduced motion or motion paused", async () => {
    finishedHappyPath();
    setReducedMotion(true);
    const { unmount } = render(<Rollouts />);
    let article = await screen.findByRole("article", { name: /Order again/ });
    fireEvent.click(within(article).getByRole("button", { name: "Merge" }));
    expect(document.body.querySelector("[data-testid='merge-flight']")).toBeNull();
    expect(within(article).getByRole("status")).toHaveAttribute("data-celebration", "static");
    fireEvent.click(within(article).getByRole("button", { name: "Dismiss" }));
    expect(within(article).queryByRole("status")).not.toBeInTheDocument();
    unmount();

    resetSimulatedDemo();
    finishedHappyPath();
    setReducedMotion(false);
    localStorage.setItem("loopmate-motion", "paused");
    render(<Rollouts />);
    article = await screen.findByRole("article", { name: /Order again/ });
    fireEvent.click(within(article).getByRole("button", { name: "Merge" }));
    expect(document.body.querySelector("[data-testid='merge-flight']")).toBeNull();
    expect(within(article).getByRole("status")).toHaveAttribute("data-celebration", "static");
  });

  it("opens a deep-linked PR under its own product", async () => {
    selectProduct("checkout");
    seedSampleLoop("uber-eats");
    const target = listSimulatedRuns().find((r) => r.kind === "fix")!;
    store.search = { pr: target.id };
    render(<Rollouts />);
    const article = await screen.findByRole("article", { name: /Simulated PR: Fix:/ });
    expect(within(article).getByRole("region", { name: /PR review/ })).toBeInTheDocument();
    const other = screen.getByRole("article", { name: /Simulated PR: Experiment:/ });
    expect(within(other).queryByRole("region", { name: /PR review/ })).not.toBeInTheDocument();
  });

  it("keeps bug fixes secondary: fixes in progress and approved fixes for the Fixer", async () => {
    selectProduct("checkout");
    seedSampleLoop("checkout");
    startSimulatedRun(makeFinding({ title: "Fix underway", suggested_test: test }), "fix", {
      product_id: "checkout",
      now: new Date(Date.now() - 8000),
    });
    startSimulatedRun(
      makeFinding({ title: "Long experiment", suggested_test: test }),
      "experiment",
      {
        product_id: "checkout",
        now: new Date(Date.now() - EXPERIMENT_DURATION_MS / 2),
      },
    );
    store.sessions = [
      withFindings([
        {
          title: "Approved fix",
          suggested_test: test,
          suggested_route: "fix",
          test_decision: { decision: "approved", edited: false },
        },
      ]),
    ];
    render(<Rollouts />);
    const fixing = await screen.findByRole("article", {
      name: "Simulated fix in progress: Fix underway",
    });
    expect(
      within(fixing).getByText("Verifying on recordings", { selector: "strong" }),
    ).toBeTruthy();
    expect(screen.getByText(/1 test still running/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bug fixes" })).toBeInTheDocument();
    expect(await screen.findByText("Approved fix")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Send to Fixer/ }));
    expect(
      await screen.findByRole("article", { name: "Simulated fix in progress: Approved fix" }),
    ).toBeInTheDocument();
    const open = screen
      .getAllByRole("article", { name: /Simulated PR:/ })
      .find((a) => within(a).queryByRole("button", { name: /Review PR/ }))!;
    fireEvent.click(within(open).getByRole("button", { name: /Review PR/ }));
    fireEvent.click(within(open).getByRole("button", { name: "Close" }));
    expect(await within(open).findAllByText("Closed")).not.toHaveLength(0);
    expect(listSimulatedRuns().some((run) => run.pr.status === "closed")).toBe(true);
    expectAllSimulatedCardsBadged();
  });
});
