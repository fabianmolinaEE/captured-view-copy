import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoodDeliveryDemo } from "@/components/research/FoodDeliveryDemo";
import { aggregateInsights } from "@/lib/research/insights";
import { demoSources } from "@/lib/research/types";
import { makeSession } from "./research-fixtures";

afterEach(cleanup);
describe("food delivery research", () => {
  it("keeps the non-clickable image inert while the explicit item action works", () => {
    const log = vi.fn();
    render(<FoodDeliveryDemo enabled={["dead_click"]} log={log} onScreen={vi.fn()} />);
    fireEvent.click(screen.getByRole("img", { name: /Vegetable pizza/ }));
    expect(screen.getByRole("heading", { name: /happy bite/ })).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /View item/ })[0]!);
    expect(screen.getByRole("group", { name: "Choose your size" })).toBeInTheDocument();
  });
  it("lets a real backtrack recover missing context, retaining portion and quantity", () => {
    const log = vi.fn();
    render(
      <FoodDeliveryDemo
        enabled={["missing_context", "text_clipping"]}
        log={log}
        onScreen={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /View item/ })[0]!);
    fireEvent.click(screen.getByRole("radio", { name: /Large/ }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /Add to basket/ }));
    expect(screen.queryByText(/Serves 2/)).not.toBeInTheDocument();
    expect(screen.getByText(/Roasted Garden Vegetable/)).toHaveClass("delivery-truncate");
    expect(screen.getByText(/1847 West/)).toHaveClass("delivery-truncate");
    fireEvent.click(screen.getByRole("button", { name: "Edit item" }));
    expect(screen.getByRole("radio", { name: /Large/ })).toBeChecked();
    expect(screen.getByText("Serves 2 · ideal for sharing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update basket/ })).toHaveTextContent("$44.00");
    expect(log).toHaveBeenCalledWith("backtrack", "edit_item");
    expect(JSON.stringify(log.mock.calls)).not.toContain("1847 West");
  });
  it("provides a clean comparison with working image links, full names and portion context", () => {
    render(<FoodDeliveryDemo enabled={[]} log={vi.fn()} onScreen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /View Roasted Garden/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add to basket/ }));
    expect(screen.getByText("Regular · Serves 1")).toBeInTheDocument();
    expect(screen.getByText(/Roasted Garden Vegetable/)).not.toHaveClass("delivery-truncate");
    expect(screen.getByText(/1847 West/)).not.toHaveClass("delivery-truncate");
    fireEvent.click(screen.getByRole("button", { name: "Edit delivery address" }));
    fireEvent.click(screen.getByRole("radio", { name: /92 Example Lane/ }));
    fireEvent.click(screen.getByRole("button", { name: /Use this address/ }));
    expect(screen.getByText("92 Example Lane, Apartment 204")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Place demo order/ }));
    expect(screen.getByRole("heading", { name: /great taste/ })).toBeInTheDocument();
  });
  it("separates source cohorts in priorities, even for matching categories and screens", () => {
    const carry = makeSession({ source_app: demoSources.checkout });
    const delivery = makeSession({ source_app: demoSources.delivery });
    const cleanDelivery = makeSession({ source_app: demoSources.delivery, findings: [] });
    const groups = aggregateInsights([carry, delivery, cleanDelivery]);
    expect(groups).toHaveLength(2);
    expect(
      groups.find((g) => g.evidence[0]!.session.source_app === demoSources.checkout),
    ).toMatchObject({ affected: 1, eligible: 1, percentage: 100 });
    expect(
      groups.find((g) => g.evidence[0]!.session.source_app === demoSources.delivery),
    ).toMatchObject({ affected: 1, eligible: 2, percentage: 50 });
  });
});
