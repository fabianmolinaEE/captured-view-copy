import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  evidenceProductOf,
  selectProduct,
  useProduct,
  useEvidenceProduct,
} from "@/hooks/use-product";
import { isArchivedSession, productForSource, sessionsForProduct } from "@/lib/research/products";
import { createCompetitorSession, doorDashCandidates } from "@/lib/research/competitors";
import { aggregateInsights } from "@/lib/research/insights";
import { createPublicSession, uberEatsCandidates } from "@/lib/research/publicVideo";
import { demoSources, type Session } from "@/lib/research/types";
import { makeSession } from "./research-fixtures";

const store = vi.hoisted(() => ({ sessions: [] as Session[], path: "/", navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={to} className={className} aria-label={props["aria-label"] as string}>
      {children}
    </a>
  ),
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select({ pathname: store.path }),
  useNavigate: () => store.navigate,
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  listSessions: async () => store.sessions,
  saveSession: vi.fn(),
  deleteSession: vi.fn(),
}));
import { Home } from "@/components/research/Home";
import { Insights } from "@/components/research/Insights";
import { Sessions } from "@/components/research/Sessions";
import { Evaluation } from "@/components/research/Evaluation";
import { TestApp } from "@/components/research/TestApp";
import { Shell } from "@/components/research/Shell";

beforeEach(() => {
  sessionStorage.clear();
  selectProduct(null);
  store.path = "/";
  store.navigate.mockReset();
  const bag = makeSession({ title: "Bag session" });
  bag.findings[0]!.title = "Bag-only finding";
  const delivery = makeSession({ title: "Delivery session", source_app: "Uber Eats" });
  delivery.findings[0]!.title = "Delivery-only finding";
  store.sessions = [bag, delivery];
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  sessionStorage.clear();
});

describe("product workspace", () => {
  it("opens Home without a product choice and shows a labeled workspace overview", async () => {
    const view = render(<Home />);
    expect(screen.getByRole("heading", { name: /From zero to hero/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Choose product" })).not.toBeInTheDocument();
    expect(screen.queryByText("Which product are we improving?")).not.toBeInTheDocument();
    await screen.findByRole("link", { name: /Delivery session/ });
    expect(screen.getByRole("link", { name: /Bag session/ })).toBeInTheDocument();
    expect(screen.getByText(/^Across your products/)).toBeInTheDocument();
    view.unmount();
    selectProduct("checkout");
    render(<Home />);
    expect(screen.queryByRole("region", { name: "Choose product" })).not.toBeInTheDocument();
    await screen.findByRole("link", { name: /Delivery session/ });
    expect(screen.getByRole("link", { name: /Bag session/ })).toBeInTheDocument();
  });
  it("asks for a product on Insights before showing product analytics", async () => {
    render(<Insights />);
    expect(
      screen.getByRole("heading", { name: "Which product are we improving?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bag-only finding" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Uber Eats" }));
    await screen.findByRole("heading", { name: "Delivery-only finding" });
    expect(screen.queryByRole("heading", { name: "Bag-only finding" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(screen.getByRole("heading", { name: "Bag-only finding" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Delivery-only finding" }),
    ).not.toBeInTheDocument();
  });
  it("keeps selection through remounts and scopes findings and recording totals", async () => {
    selectProduct("uber-eats");
    const view = render(<Insights />);
    await screen.findByRole("heading", { name: "Delivery-only finding" });
    expect(screen.queryByRole("heading", { name: "Bag-only finding" })).not.toBeInTheDocument();
    view.unmount();
    store.path = "/sessions";
    render(<Sessions />);
    await screen.findByRole("link", { name: "Delivery session" });
    expect(screen.queryByRole("link", { name: "Bag session" })).not.toBeInTheDocument();
    expect(screen.getByText("Total sessions").closest(".stat")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(screen.getByRole("link", { name: "Bag session" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Delivery session" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carry checkout")).not.toBeInTheDocument();
  });
  it("scopes evaluation labels, results and research-set denominators", async () => {
    selectProduct("uber-eats");
    render(<Evaluation />);
    await screen.findByRole("heading", { name: "Delivery session" });
    expect(screen.queryByRole("heading", { name: "Bag session" })).not.toBeInTheDocument();
    expect(screen.getByText("1 recordings")).toBeInTheDocument();
    expect(screen.getByLabelText("Observed long_loading in Delivery session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(screen.getByLabelText("Observed long_loading in Bag session")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Observed long_loading in Delivery session"),
    ).not.toBeInTheDocument();
  });
  it("disables switching during capture and returns to lists when switching from a detail page", () => {
    selectProduct("uber-eats");
    store.path = "/sessions/test-id";
    const view = render(
      <Shell section="Test App" productSwitchDisabled>
        Recording
      </Shell>,
    );
    const picker = screen.getByRole("region", { name: "Choose product" });
    expect(within(picker).getByRole("button", { name: "Bag Checkout App" })).toBeDisabled();
    view.rerender(<Shell section="Session review">Evidence</Shell>);
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(store.navigate).toHaveBeenCalledWith({ to: "/sessions" });
  });
  it("opens the selected product fixture and switches it with the workspace", () => {
    selectProduct("uber-eats");
    render(<TestApp />);
    expect(screen.getByRole("heading", { name: "Add recording", level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(screen.getByRole("checkbox", { name: /Long loading/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Looks clickable/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore the bag" })).toBeInTheDocument();
  });
  it("adopts a deep-linked recording's product without rewriting the recording", () => {
    const legacy = makeSession();
    selectProduct("uber-eats");
    const view = renderHook(() => ({
      matches: useEvidenceProduct(legacy),
      selected: useProduct().productId,
    }));
    expect(view.result.current.matches).toBe(true);
    expect(view.result.current.selected).toBe("checkout");
    expect(legacy.source_app).toBe("Carry checkout");
  });
  it("opens Uber Eats as a separate source workspace without relabeling Miso data", () => {
    selectProduct("uber-eats");
    render(<TestApp />);
    expect(screen.getByRole("heading", { name: "Add recording", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(5);
    expect(screen.queryByRole("checkbox", { name: /Looks clickable/ })).not.toBeInTheDocument();
    expect(sessionsForProduct(store.sessions, "uber-eats")).toHaveLength(1);
    expect(productForSource(demoSources.delivery)).toBeUndefined();
    expect(screen.queryByRole("button", { name: /Miso/ })).not.toBeInTheDocument();
  });
  it("validates the persisted choice, retains legacy sources and never assigns unknown products", () => {
    sessionStorage.setItem("loopmate-product", "invalid-product");
    const view = renderHook(() => useProduct());
    expect(view.result.current.productId).toBeNull();
    act(() => selectProduct("checkout"));
    expect(view.result.current.product?.name).toBe("Bag Checkout App");
    view.unmount();
    expect(renderHook(() => useProduct()).result.current.productId).toBe("checkout");
    expect(productForSource("Carry checkout")?.id).toBe("checkout");
    expect(sessionsForProduct(store.sessions, null)).toEqual([]);
    expect(sessionsForProduct([makeSession({ source_app: "Other product" })], "uber-eats")).toEqual(
      [],
    );
    const renamed = makeSession({ source_app: demoSources.checkout });
    expect(aggregateInsights([store.sessions[0]!, renamed])[0]).toMatchObject({
      affected: 2,
      eligible: 2,
      percentage: 100,
    });
  });
  it("shows saved Uber Eats sessions as rows plus the in-page library, scoped by product", async () => {
    const recordings = uberEatsCandidates
      .slice(0, 4)
      .map((source) => createPublicSession(source, 120000, 0, 60000));
    store.sessions = [...store.sessions, ...recordings];
    selectProduct("uber-eats");
    const view = render(<Sessions />);
    await screen.findByRole("link", { name: recordings[0]!.title });
    expect(view.container.querySelectorAll(".session-row")).toHaveLength(5);
    const library = screen.getByRole("region", { name: "Uber Eats · Recording library" });
    expect(within(library).getAllByText("Saved")).toHaveLength(4);
    expect(within(library).getAllByText("Available")).toHaveLength(1);
    expect(within(library).getAllByRole("button", { name: /Play .* here/ })).toHaveLength(5);
    expect(
      screen.getByRole("region", { name: "Competitor footage · Explorer" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/case study|Sunday|pitch|public walkthrough/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(view.container.querySelectorAll(".session-row")).toHaveLength(1);
    expect(view.container.querySelector(".public-source-grid")).not.toBeInTheDocument();
    expect(store.sessions).toHaveLength(6);
  });
  it("keeps DoorDash competitor footage out of Uber Eats rows, totals and the archive", async () => {
    const doordash = createCompetitorSession(doorDashCandidates[0]!, "uber-eats", 120000, 0, 60000);
    store.sessions = [...store.sessions, doordash];
    selectProduct("uber-eats");
    const view = render(<Sessions />);
    const saved = await screen.findByRole("region", { name: "Saved DoorDash recordings" });
    expect(within(saved).getByRole("link", { name: doordash.title })).toBeInTheDocument();
    expect(within(saved).getByText(/Not counted in Uber Eats metrics/)).toBeInTheDocument();
    // Only the own-product row is in the main list; the competitor row lives in its section.
    expect(view.container.querySelectorAll(".session-row:not(.competitor-row)")).toHaveLength(1);
    expect(screen.getByText("Total sessions").closest(".stat")).toHaveTextContent("1");
    expect(screen.queryByText(/Archived recordings/)).not.toBeInTheDocument();
    expect(sessionsForProduct(store.sessions, "uber-eats")).toHaveLength(1);
    expect(isArchivedSession(doordash)).toBe(false);
    // Even if mislabeled with an own source, explicit competitor provenance keeps it out.
    expect(sessionsForProduct([{ ...doordash, source_app: "Uber Eats" }], "uber-eats")).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Bag Checkout App" }));
    expect(
      screen.queryByRole("region", { name: "Saved DoorDash recordings" }),
    ).not.toBeInTheDocument();
  });
  it("adopts Uber Eats for a deep-linked competitor recording", () => {
    const doordash = createCompetitorSession(doorDashCandidates[1]!, "uber-eats", 120000, 0, 60000);
    selectProduct("checkout");
    const view = renderHook(() => ({
      matches: useEvidenceProduct(doordash),
      selected: useProduct().productId,
    }));
    expect(view.result.current.matches).toBe(true);
    expect(view.result.current.selected).toBe("uber-eats");
    expect(evidenceProductOf(makeSession({ source_app: demoSources.delivery }))).toBeUndefined();
  });
  it("archives the old delivery fixture without relabeling it as Uber Eats", async () => {
    store.sessions.push(
      makeSession({ title: "Archived delivery recording", source_app: demoSources.delivery }),
    );
    selectProduct("uber-eats");
    const view = render(<Sessions />);
    await screen.findByText("Archived recordings · 1");
    expect(screen.getByText("Archived delivery recording").closest("details")).toBeInTheDocument();
    expect(view.container.querySelectorAll(".session-row")).toHaveLength(1);
    expect(productForSource(demoSources.delivery)).toBeUndefined();
    expect(store.sessions.at(-1)?.source_app).toBe(demoSources.delivery);
  });
});
