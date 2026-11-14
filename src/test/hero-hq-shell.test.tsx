import { render, screen, cleanup, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

const state = vi.hoisted(() => ({
  location: { pathname: "/hq", search: {} as Record<string, unknown> },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const query = search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "";
    return (
      <a
        href={`${to}${query}`}
        className={props["className"] as string}
        aria-current={props["aria-current"] as "page" | undefined}
      >
        {children}
      </a>
    );
  },
  useLocation: ({ select }: { select: (l: typeof state.location) => unknown }) =>
    select(state.location),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/research/sessionStorage", () => ({ listSessions: async () => [] }));

import { Shell } from "@/components/research/Shell";
import { selectProduct } from "@/hooks/use-product";

beforeEach(() => {
  localStorage.clear();
  state.location = { pathname: "/hq", search: {} };
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  localStorage.clear();
});

describe("HQ navigation", () => {
  it("is the first of four functional nav items and is active on /hq", async () => {
    render(
      <Shell section="HQ">
        <p>HQ body</p>
      </Shell>,
    );
    const nav = screen.getByRole("navigation", { name: "Improvement loop" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "HQ",
      "Insights",
      "A/B Tests",
      "Rollouts",
    ]);
    // Hero names are internal labels, never nav items.
    for (const name of ["Hero HQ", "Competitors", "Tracker", "Explorer", "Experimenter", "Fixer"])
      expect(within(nav).queryByRole("link", { name })).not.toBeInTheDocument();
    expect(links[0]).toHaveAttribute("href", "/hq");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Insights" })).not.toHaveAttribute("aria-current");
    await screen.findByText("HQ body");
  });

  it("is workspace-wide: no product picker, even before a product is chosen", async () => {
    selectProduct(null);
    render(
      <Shell section="HQ">
        <p>HQ body</p>
      </Shell>,
    );
    expect(await screen.findByText("HQ body")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose product" })).not.toBeInTheDocument();
    expect(document.querySelector(".desktop-crumb")).toHaveTextContent(/Workspace\s*\/\s*HQ/);
  });

  it("keeps product scoping on other primary areas", () => {
    state.location = { pathname: "/insights", search: {} };
    render(
      <Shell section="Insights">
        <p>Insights body</p>
      </Shell>,
    );
    expect(screen.queryByText("Insights body")).not.toBeInTheDocument();
  });
});
