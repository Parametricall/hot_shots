import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control";

const OPTIONS = [
  { value: "tipsters", label: "Tipsters" },
  { value: "ladder", label: "AFL Ladder" },
] as const;

describe("SegmentedControl", () => {
  it("marks the selected segment as pressed", () => {
    render(
      <SegmentedControl label="Stats view" value="ladder" options={OPTIONS} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("group", { name: "Stats view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AFL Ladder" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Tipsters" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onChange with the segment picked", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Stats view"
        value="tipsters"
        options={OPTIONS}
        onChange={onChange}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "AFL Ladder" }));
    expect(onChange).toHaveBeenCalledWith("ladder");
  });
});
