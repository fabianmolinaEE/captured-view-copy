import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getScout,
  isScoutId,
  scoutBuckets,
  scoutForRoute,
  scoutIds,
  scouts,
  scoutsInBucket,
} from "@/lib/research/scouts";
import { ScoutMascot } from "@/components/research/ScoutMascot";
import { ScoutCard } from "@/components/research/ScoutCard";
import { SimulatedBadge } from "@/components/research/SimulatedBadge";

afterEach(cleanup);

describe("scout metadata", () => {
  it("defines four color-coded scouts in two buckets with honest statuses", () => {
    expect(scoutIds).toEqual(["tracker", "explorer", "fixer", "experimenter"]);
    expect(scoutsInBucket("find").map((s) => s.id)).toEqual(["tracker", "explorer"]);
    expect(scoutsInBucket("change").map((s) => s.id)).toEqual(["fixer", "experimenter"]);
    expect(scoutBuckets.map((b) => b.label)).toEqual([
      "Find what to improve",
      "Change the product",
    ]);
    expect(getScout("tracker").tagline).toBe("Watches your product. Finds where users struggle.");
    expect(getScout("explorer").tagline).toBe("Watches competitors. Learns from their user flow.");
    expect(getScout("fixer").tagline).toBe("Clear bug? Builds a fix.");
    expect(getScout("experimenter").tagline).toBe(
      "Open question? Designs, runs and analyses the test.",
    );
    expect(scouts.map((s) => s.status)).toEqual(["real", "real", "simulated", "simulated"]);
    expect(scouts.map((s) => s.colorName)).toEqual(["blue", "green", "orange", "purple"]);
    expect(new Set(scouts.map((s) => s.colors.main)).size).toBe(4);
    expect(scoutForRoute("fix").id).toBe("fixer");
    expect(scoutForRoute("experiment").id).toBe("experimenter");
    expect(isScoutId("fixer")).toBe(true);
    expect(isScoutId("collector")).toBe(false);
  });
});

describe("scout mascots", () => {
  it("renders all four as labeled images with role gear and no external images", () => {
    const { container } = render(
      <div>
        {scoutIds.map((id) => (
          <ScoutMascot key={id} scout={id} />
        ))}
      </div>,
    );
    for (const name of [
      "Tracker, the blue scout",
      "Explorer, the green scout",
      "Fixer, the orange scout",
      "Experimenter, the purple scout",
    ])
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    expect(container.querySelector('[data-gear="magnifier chart"]')).not.toBeNull();
    expect(container.querySelector('[data-gear="explorer-hat flag binoculars"]')).not.toBeNull();
    expect(container.querySelector('[data-gear="hard-hat wrench"]')).not.toBeNull();
    expect(container.querySelector('[data-gear="goggles flask"]')).not.toBeNull();
    expect(container.querySelector("img, image")).toBeNull();
  });

  it("animates only on request, behind motion-safe, and can be decorative", () => {
    const { container } = render(
      <>
        <ScoutMascot scout="fixer" animated title="Fixer mascot" size={80} />
        <ScoutMascot scout="tracker" decorative />
      </>,
    );
    const fixer = screen.getByRole("img", { name: "Fixer mascot" });
    expect(fixer).toHaveAttribute("data-animated", "true");
    expect(fixer.getAttribute("class")).toContain("motion-safe:animate-[mascot-hover");
    expect(fixer).toHaveAttribute("width", "80");
    const tracker = container.querySelector('[data-scout="tracker"]')!;
    expect(tracker).toHaveAttribute("aria-hidden", "true");
    expect(tracker).toHaveAttribute("data-animated", "false");
    expect(tracker.getAttribute("class")).not.toContain("animate-");
  });
});

describe("scout cards and simulated badge", () => {
  it("shows name, tagline, bucket and status pill for every scout", () => {
    render(
      <div>
        {scoutIds.map((id) => (
          <ScoutCard key={id} scout={id} />
        ))}
      </div>,
    );
    const tracker = screen.getByRole("article", { name: "Tracker scout" });
    expect(within(tracker).getByRole("heading", { name: "Tracker" })).toBeInTheDocument();
    expect(within(tracker).getByText(/Find what to improve/)).toBeInTheDocument();
    expect(within(tracker).getByText("Real")).toBeInTheDocument();
    const explorer = screen.getByRole("article", { name: "Explorer scout" });
    expect(within(explorer).getByText("Real")).toBeInTheDocument();
    for (const name of ["Fixer scout", "Experimenter scout"]) {
      const card = screen.getByRole("article", { name });
      expect(within(card).getByText(/Change the product/)).toBeInTheDocument();
      expect(within(card).getByText("Simulated demo")).toBeVisible();
    }
  });

  it("renders an optional speech bubble", () => {
    render(<ScoutCard scout="explorer" speech="DoorDash puts reorder on the home screen." />);
    expect(screen.getByText("Explorer says:")).toBeInTheDocument();
    expect(screen.getByText("DoorDash puts reorder on the home screen.")).toBeInTheDocument();
  });

  it("keeps the simulated label visible with optional detail", () => {
    render(<SimulatedBadge detail="No repository is connected." />);
    const label = screen.getByText("Simulated demo");
    expect(label).toBeVisible();
    const pill = label.closest("[data-simulated]")!;
    expect(pill).toHaveAttribute("title", "No repository is connected.");
    expect(pill).toHaveTextContent("No repository is connected.");
  });
});
