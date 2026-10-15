import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundNavigation } from "./round-navigation";
import type { AflRound } from "~/features/afl-tipping/types";

function makeRounds(count: number): AflRound[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: i === 0 ? "Opening Round" : `Round ${i}`,
    games: [],
  }));
}

describe("RoundNavigation", () => {
  it("displays the current round name", () => {
    const rounds = makeRounds(5);
    render(<RoundNavigation rounds={rounds} currentRound={2} onRoundChange={vi.fn()} />);
    expect(screen.getAllByText("Round 2").length).toBeGreaterThan(0);
  });

  it("displays round count as 'X of Y'", () => {
    const rounds = makeRounds(10);
    render(<RoundNavigation rounds={rounds} currentRound={3} onRoundChange={vi.fn()} />);
    expect(screen.getByText(/4 of 10/)).toBeInTheDocument();
  });

  it("calls onRoundChange with previous round when Prev is clicked", async () => {
    const user = userEvent.setup();
    const onRoundChange = vi.fn();
    render(
      <RoundNavigation rounds={makeRounds(5)} currentRound={2} onRoundChange={onRoundChange} />,
    );

    // Mobile and desktop each render a Prev button; either click should trigger the handler.
    const [prevButton] = screen.getAllByRole("button", { name: /prev/i });
    await user.click(prevButton!);
    expect(onRoundChange).toHaveBeenCalledWith(1);
  });

  it("calls onRoundChange with next round when Next is clicked", async () => {
    const user = userEvent.setup();
    const onRoundChange = vi.fn();
    render(
      <RoundNavigation rounds={makeRounds(5)} currentRound={2} onRoundChange={onRoundChange} />,
    );

    const [nextButton] = screen.getAllByRole("button", { name: /next/i });
    await user.click(nextButton!);
    expect(onRoundChange).toHaveBeenCalledWith(3);
  });

  it("disables Prev button on the first round", () => {
    render(<RoundNavigation rounds={makeRounds(5)} currentRound={0} onRoundChange={vi.fn()} />);
    const prevButtons = screen.getAllByRole("button", { name: /prev/i });
    prevButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("disables Next button on the last round", () => {
    render(<RoundNavigation rounds={makeRounds(5)} currentRound={4} onRoundChange={vi.fn()} />);
    const nextButtons = screen.getAllByRole("button", { name: /next/i });
    nextButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("shows 'no round' when the current round index has no matching round", () => {
    const rounds = makeRounds(2);
    render(<RoundNavigation rounds={rounds} currentRound={99} onRoundChange={vi.fn()} />);
    expect(screen.getAllByText("no round").length).toBeGreaterThan(0);
  });
});
