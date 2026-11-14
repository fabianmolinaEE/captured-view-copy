import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Session } from "@/lib/research/types";
import { makeRun, makeSession } from "./research-fixtures";

const state = vi.hoisted(() => ({
  sessions: [] as Session[],
  location: { pathname: "/insights", search: {} as Record<string, unknown> },
  analyze: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    hash,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search?: Record<string, string>;
    hash?: string;
    [key: string]: unknown;
  }) => {
    const query = search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "";
    return (
      <a
        href={`${to}${query}${hash ? `#${hash}` : ""}`}
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
vi.mock("@/lib/research/sessionStorage", () => ({
  listSessions: async () => state.sessions,
  getSampling: async () => ({ interval_seconds: 1, max_frames: 20, max_width: 640 }),
  saveSampling: vi.fn(),
  clearAll: vi.fn(),
}));
vi.mock("@/lib/research/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/research/apiClient")>();
  return {
    ...actual,
    connectionStatus: async () => ({
      configured: true,
      backend_configured: false,
      model: "test-model",
      message: "Connected for tests.",
    }),
    saveAccessCode: vi.fn(),
    analyzeSession: state.analyze,
  };
});
import { Shell } from "@/components/research/Shell";
import { Settings } from "@/components/research/Settings";
import { AnalysisPanel } from "@/components/research/AnalysisPanel";
import { selectProduct } from "@/hooks/use-product";
import { setAgentSettings } from "@/hooks/use-agent-settings";
import {
  AGENT_SETTINGS_KEY,
  defaultAgentSettings,
  updateScoutSettings,
} from "@/lib/research/agentSettings";
import { SIMULATION_KEY, seedSampleLoop } from "@/lib/research/simulation";

beforeEach(() => {
  localStorage.clear();
  state.sessions = [];
  state.location = { pathname: "/insights", search: {} };
  state.analyze.mockReset();
  selectProduct("checkout");
});
afterEach(() => {
  cleanup();
  selectProduct(null);
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Shell scout navigation", () => {
  it("lists HQ, Insights, A/B Tests and Rollouts with research tools secondary", async () => {
    render(
      <Shell section="Insights">
        <p>Body</p>
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
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/hq",
      "/insights",
      "/ab-tests",
      "/rollouts",
    ]);
    expect(within(nav).getByRole("link", { name: "Insights" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("navigation", { name: "Research tools" })).toBeInTheDocument();
    expect(screen.getByText("Research tools", { selector: "summary" })).toBeInTheDocument();
    expect(screen.getAllByText("(leaving soon)").length).toBeGreaterThan(0);
    await screen.findByText("Body");
  });
  it("keeps Insights active for legacy ?tab=competitors links (no Competitors tab)", () => {
    state.location = { pathname: "/insights", search: { tab: "competitors" } };
    render(
      <Shell section="Insights">
        <p>Body</p>
      </Shell>,
    );
    const nav = screen.getByRole("navigation", { name: "Improvement loop" });
    expect(within(nav).queryByRole("link", { name: "Competitors" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Insights" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("Settings → Scouts", () => {
  it("tunes each scout locally and labels the missing runner", async () => {
    render(<Settings />);
    const section = screen.getByRole("region", { name: "Scouts" });
    for (const name of ["Tracker", "Explorer", "Fixer", "Experimenter"])
      expect(within(section).getByRole("article", { name: `${name} scout` })).toBeInTheDocument();
    const tracker = within(section).getByRole("article", { name: "Tracker scout" });
    const fixer = within(section).getByRole("article", { name: "Fixer scout" });
    expect(within(fixer).queryByRole("group", { name: "Focus areas" })).not.toBeInTheDocument();
    expect(within(fixer).getByText(/labeled simulated run/)).toBeInTheDocument();
    expect(within(section).getAllByText(/Runner not connected in prototype/)).toHaveLength(4);

    fireEvent.click(within(tracker).getByRole("switch", { name: "Send out Tracker" }));
    fireEvent.click(within(tracker).getByRole("checkbox", { name: "Target size" }));
    fireEvent.change(within(tracker).getByRole("spinbutton", { name: "Max analyses per day" }), {
      target: { value: "3" },
    });
    fireEvent.change(within(tracker).getByRole("slider"), { target: { value: "60" } });
    fireEvent.change(within(tracker).getByRole("combobox", { name: "Cadence" }), {
      target: { value: "hourly" },
    });
    const saved = JSON.parse(localStorage.getItem(AGENT_SETTINGS_KEY) ?? "{}");
    expect(saved.tracker).toEqual({
      enabled: false,
      focus_areas: ["target_size"],
      min_confidence: 0.6,
      max_analyses_per_day: 3,
      cadence: "hourly",
    });
    expect(within(tracker).getByText("Minimum confidence to surface: 60%")).toBeInTheDocument();
    await within(tracker).findByText(/Used today: 0 of 3/);
  });
  it("resets only simulated demo data", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedSampleLoop("uber-eats");
    render(<Settings />);
    const reset = screen.getByRole("button", { name: "Reset simulated demo data" });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(localStorage.getItem(SIMULATION_KEY) ?? "[]").toMatch(/^\[\]$|^$/);
    await screen.findByText(/Simulated demo data cleared. Research data was not changed./);
    expect(screen.getByRole("button", { name: "Reset simulated demo data" })).toBeDisabled();
  });
});

describe("AnalysisPanel sends out a scout", () => {
  const consentAndRun = async (name: string) => {
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve sending/ }));
    const button = await screen.findByRole("button", { name });
    return button;
  };
  it("passes the Tracker's focus areas and counts today's runs", async () => {
    setAgentSettings(
      updateScoutSettings(defaultAgentSettings, "tracker", { focus_areas: ["copy", "trust"] }),
    );
    const session = makeSession({ runs: [] });
    state.sessions = [session];
    state.analyze.mockResolvedValue({ run: makeRun(), findings: [] });
    const onResult = vi.fn(async () => {});
    render(<AnalysisPanel session={session} onResult={onResult} onError={() => {}} />);
    expect(screen.getByText("Send out Tracker", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByTestId("scout-focus")).toHaveTextContent("Copy and labels, Trust");
    await screen.findByText("Today: 0 of 20 analyses used by Tracker.");
    const button = await consentAndRun("Send out Tracker");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    const options = state.analyze.mock.calls[0]![3];
    expect(options.focus_areas).toEqual(["copy", "trust"]);
    expect(options.usage).toMatchObject({ scout: "tracker", used: 0, max: 20, blocked: false });
  });
  it("disables Analyze at the daily cap without recording a failed run", async () => {
    setAgentSettings(
      updateScoutSettings(defaultAgentSettings, "tracker", { max_analyses_per_day: 1 }),
    );
    const session = makeSession({ runs: [makeRun({ started_at: new Date().toISOString() })] });
    state.sessions = [session];
    const onResult = vi.fn(async () => {});
    render(<AnalysisPanel session={session} onResult={onResult} onError={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tracker reached today's cap of 1 analysis.",
    );
    const button = await consentAndRun("Send out Tracker");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(state.analyze).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });
  it("sends the Explorer for competitor footage", async () => {
    const session = makeSession({ runs: [], source_app: "DoorDash" });
    state.sessions = [session];
    render(<AnalysisPanel session={session} onResult={async () => {}} onError={() => {}} />);
    expect(screen.getByText("Send out Explorer", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/patterns to adopt or avoid in Uber Eats/)).toBeInTheDocument();
    await screen.findByText("Today: 0 of 10 analyses used by Explorer.");
  });
});
