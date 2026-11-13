import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { makeSession } from "./research-fixtures";
const store = vi.hoisted(() => ({ sessions: [] as Session[] }));
vi.mock("@tanstack/react-router", () => ({
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
vi.mock("@/lib/research/sessionStorage", () => ({ listSessions: async () => store.sessions }));
import { Home } from "@/components/research/Home";
import { Insights } from "@/components/research/Insights";
import { ComingSoon } from "@/components/research/ComingSoon";
beforeEach(() => {
  store.sessions = [];
});
afterEach(() => cleanup());
describe("LoopMate workspace", () => {
  it("opens the three workflow areas without fabricated research", async () => {
    render(<Home />);
    await screen.findByText("A recording is a great place to start.");
    expect(screen.getByRole("heading", { name: "Insights" }).closest("a")).toHaveAttribute(
      "href",
      "/insights",
    );
    expect(screen.getByRole("heading", { name: "A/B Tests" }).closest("a")).toHaveAttribute(
      "href",
      "/ab-tests",
    );
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(screen.getAllByText("0")).toHaveLength(3);
  });
  it("shows real pending findings before aggregation and separates external plans", async () => {
    const session = makeSession();
    session.findings[0]!.review_status = "pending";
    store.sessions = [session];
    render(<Insights />);
    await screen.findByRole("heading", { name: "Observed spinner" });
    fireEvent.click(screen.getByRole("button", { name: /External/ }));
    expect(
      screen.getByText(/no competitor agents or external findings are connected yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Observed spinner" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore internal insights" }));
    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));
    expect(screen.getByText("No findings match this view.")).toBeInTheDocument();
  });
  it("keeps experiment and rollout previews free of execution controls", () => {
    const view = render(<ComingSoon area="experiments" />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText(/No experiments are running/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.rerender(<ComingSoon area="rollouts" />);
    expect(screen.getByText(/This page does not deploy changes/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
