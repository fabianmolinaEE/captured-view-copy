import { selectProduct } from "@/hooks/use-product";
import { act, render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { makeSession } from "./research-fixtures";
const store = vi.hoisted(() => ({ sessions: [] as Session[] }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} className={props["className"] as string}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/research/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Footer: () => null,
  PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/lib/research/sessionStorage", () => ({
  listSessions: async () => store.sessions,
  deleteSession: vi.fn(),
}));
import { Insights } from "@/components/research/Insights";
import { Sessions } from "@/components/research/Sessions";
beforeEach(() => {
  store.sessions = [];
  selectProduct("checkout");
});
afterEach(() => {
  cleanup();
  selectProduct(null);
});
describe("LoopMate workspace", () => {
  it("shows real pending findings in one unified view with no Competitors tab", async () => {
    const session = makeSession();
    session.findings[0]!.review_status = "pending";
    store.sessions = [session];
    render(<Insights />);
    await screen.findByRole("article", { name: "Observed spinner" });
    expect(screen.queryByRole("button", { name: /Competitors/ })).not.toBeInTheDocument();
    const source = screen.getByRole("group", { name: "Source" });
    fireEvent.click(within(source).getByRole("button", { name: /^Explorer/ }));
    expect(screen.queryByRole("article", { name: "Observed spinner" })).not.toBeInTheDocument();
    fireEvent.click(within(source).getByRole("button", { name: /^Tracker/ }));
    expect(screen.getByRole("article", { name: "Observed spinner" })).toBeInTheDocument();
  });
  it("keeps existing checkout recordings accessible separately from delivery", async () => {
    store.sessions = [
      makeSession({ title: "Original bag research" }),
      makeSession({ title: "Delivery research", source_app: "Uber Eats" }),
    ];
    render(<Sessions />);
    await screen.findByRole("link", { name: "Original bag research" });
    act(() => selectProduct("uber-eats"));
    expect(screen.queryByRole("link", { name: "Original bag research" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delivery research" })).toBeInTheDocument();
    act(() => selectProduct("checkout"));
    expect(screen.getByRole("link", { name: "Original bag research" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Delivery research" })).not.toBeInTheDocument();
    act(() => selectProduct("uber-eats"));
    expect(screen.getByRole("link", { name: "Delivery research" })).toBeInTheDocument();
  });
});
