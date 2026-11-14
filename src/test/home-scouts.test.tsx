import { render, screen, cleanup, within } from "@testing-library/react";
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
  Shell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Footer: () => null,
}));
vi.mock("@/lib/research/sessionStorage", () => ({ listSessions: async () => store.sessions }));
import { Home } from "@/components/research/Home";
beforeEach(() => {
  store.sessions = [];
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("Home", () => {
  it("keeps the hero, opens HQ and introduces the four agents without fabricated research", async () => {
    render(<Home />);
    await screen.findByText("No recordings yet");
    expect(
      screen.getByRole("heading", { name: "From zero to hero. One loop at a time." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open HQ/ })).toHaveAttribute("href", "/hq");
    expect(screen.getByRole("heading", { name: "Meet the team" })).toBeInTheDocument();
    const team = screen.getByRole("list");
    const agents = within(team).getAllByRole("link");
    expect(agents.map((link) => link.getAttribute("href"))).toEqual([
      "/insights",
      "/insights",
      "/ab-tests",
      "/rollouts",
    ]);
    expect(within(team).getAllByText("Real")).toHaveLength(2);
    expect(within(team).getAllByText("Simulated demo")).toHaveLength(2);
    expect(screen.queryByRole("group", { name: "Choose product" })).not.toBeInTheDocument();
    expect(screen.getByText("Across your products")).toBeInTheDocument();
    const real = screen.getByRole("region", { name: "Real research records" });
    expect(within(real).getAllByText("0")).toHaveLength(3);
  });
  it("counts real records only and names each recent recording's product", async () => {
    const session = makeSession({ title: "Bag run" });
    session.findings[0]!.review_status = "pending";
    store.sessions = [session, makeSession({ source_app: "DoorDash", title: "Competitor clip" })];
    render(<Home />);
    await screen.findByText("Recent recordings");
    const real = screen.getByRole("region", { name: "Real research records" });
    expect(within(real).getAllByText("1")).toHaveLength(2);
    expect(within(real).getByText("0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bag run/ })).toHaveTextContent("Bag Checkout App");
    expect(screen.queryByText("Competitor clip")).not.toBeInTheDocument();
  });
});
