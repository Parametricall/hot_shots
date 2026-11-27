import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, within } from "@testing-library/react";
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

/** The phone's strip of chips. */
const chip = (round: string) =>
  screen.getAllByRole("button", { name: new RegExp(`^${round}(,|$)`) })[0]!;

describe("RoundNavigation", () => {
  it("displays the current round name on desktop", () => {
    render(<RoundNavigation rounds={makeRounds(5)} currentRound={2} onRoundChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Round 2" })).toBeInTheDocument();
  });

  it("shows a chip for every round, named short", () => {
    const rounds = makeRounds(27);
    rounds[25] = { id: 25, name: "Qualifying Final", games: [] };
    rounds[26] = { id: 26, name: "Grand Final", games: [] };
    render(<RoundNavigation rounds={rounds} currentRound={2} onRoundChange={vi.fn()} />);

    const strip = screen.getAllByText("Opening")[0]!.closest("div")!;
    const labels = within(strip)
      .getAllByRole("button")
      .map((button) => button.querySelector("[aria-hidden]")?.textContent);
    expect(labels.slice(0, 3)).toEqual(["Opening", "R1", "R2"]);
    expect(labels.slice(-2)).toEqual(["Qualifying", "Grand"]);
  });

  it("marks the selected chip and the current Round for assistive tech", () => {
    render(
      <RoundNavigation
        rounds={makeRounds(5)}
        currentRound={2}
        activeRound={3}
        onRoundChange={vi.fn()}
      />,
    );
    expect(chip("Round 2")).toHaveAttribute("aria-current", "true");
    expect(chip("Round 1")).not.toHaveAttribute("aria-current");
    expect(chip("Round 3")).toHaveAccessibleName(/Round 3, current/);
  });

  it("calls onRoundChange with the round of the chip tapped", async () => {
    const onRoundChange = vi.fn();
    render(
      <RoundNavigation rounds={makeRounds(5)} currentRound={2} onRoundChange={onRoundChange} />,
    );

    await userEvent.setup().click(chip("Round 4"));
    expect(onRoundChange).toHaveBeenCalledWith(4);
  });

  it("gives each chip a dot for its tipping status", () => {
    render(
      <RoundNavigation
        rounds={makeRounds(4)}
        currentRound={1}
        onRoundChange={vi.fn()}
        statuses={["closed", "tipped", "untipped", undefined]}
      />,
    );
    expect(chip("Opening Round")).toHaveAccessibleName(/locked/);
    expect(chip("Round 1")).toHaveAccessibleName(/all tipped/);
    expect(chip("Round 2")).toHaveAccessibleName(/some games untipped/);
    expect(chip("Round 3").querySelector("[data-status]")).toBeNull();
    expect(chip("Round 1").querySelector("[data-status]")).toHaveAttribute("data-status", "tipped");
  });

  it("scrolls the selected chip to the middle of the strip", () => {
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo;
    try {
      render(<RoundNavigation rounds={makeRounds(25)} currentRound={10} onRoundChange={vi.fn()} />);
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" }));
    } finally {
      HTMLElement.prototype.scrollTo = original;
    }
  });

  it("calls onRoundChange with previous round when Prev is clicked", async () => {
    const user = userEvent.setup();
    const onRoundChange = vi.fn();
    render(
      <RoundNavigation rounds={makeRounds(5)} currentRound={2} onRoundChange={onRoundChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Prev" }));
    expect(onRoundChange).toHaveBeenCalledWith(1);
  });

  it("calls onRoundChange with next round when Next is clicked", async () => {
    const user = userEvent.setup();
    const onRoundChange = vi.fn();
    render(
      <RoundNavigation rounds={makeRounds(5)} currentRound={2} onRoundChange={onRoundChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onRoundChange).toHaveBeenCalledWith(3);
  });

  it("disables Prev on the first round and Next on the last", () => {
    const { rerender } = render(
      <RoundNavigation rounds={makeRounds(5)} currentRound={0} onRoundChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();

    rerender(<RoundNavigation rounds={makeRounds(5)} currentRound={4} onRoundChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  describe("in a Season with no Opening Round", () => {
    // 2027 starts at Round 1: the first Round in the list is Round 1, not Round 0.
    const rounds = makeRounds(5).slice(1);

    it("names the first chip R1, with no Opening chip", () => {
      render(<RoundNavigation rounds={rounds} currentRound={1} onRoundChange={vi.fn()} />);
      expect(screen.queryByText("Opening")).toBeNull();
      expect(chip("Round 1").querySelector("[aria-hidden]")).toHaveTextContent("R1");
    });

    it("selects the Round whose number is currentRound", () => {
      render(<RoundNavigation rounds={rounds} currentRound={1} onRoundChange={vi.fn()} />);
      expect(screen.getByRole("heading", { name: "Round 1" })).toBeInTheDocument();
      expect(chip("Round 1")).toHaveAttribute("aria-current", "true");
    });

    it("calls onRoundChange with the Round number of the chip tapped", async () => {
      const onRoundChange = vi.fn();
      render(<RoundNavigation rounds={rounds} currentRound={1} onRoundChange={onRoundChange} />);
      await userEvent.setup().click(chip("Round 3"));
      expect(onRoundChange).toHaveBeenCalledWith(3);
    });

    it("disables Prev on Round 1 and steps Next to Round 2", async () => {
      const onRoundChange = vi.fn();
      render(<RoundNavigation rounds={rounds} currentRound={1} onRoundChange={onRoundChange} />);
      expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
      await userEvent.setup().click(screen.getByRole("button", { name: "Next" }));
      expect(onRoundChange).toHaveBeenCalledWith(2);
    });
  });

  it("shows 'no round' when the current round index has no matching round", () => {
    render(<RoundNavigation rounds={makeRounds(2)} currentRound={99} onRoundChange={vi.fn()} />);
    expect(screen.getByText("no round")).toBeInTheDocument();
  });
});
