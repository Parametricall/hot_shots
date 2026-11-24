import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { HowTippingWorksPage } from "./how-tipping-works";
import { GameRules } from "~/features/afl-tipping/api/game-rules";

describe("HowTippingWorksPage", () => {
  it("covers each rule under its own heading", () => {
    render(<HowTippingWorksPage />);
    expect(screen.getByRole("heading", { level: 1, name: "How tipping works" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Tip every Game",
      "Lockout",
      "The Margin game",
      "The Leaderboard",
      "Underdogs",
      "Forgot to tip?",
    ]);
  });

  it("states the Underdog quota from the game rules", () => {
    render(<HowTippingWorksPage />);
    expect(
      screen.getByText(
        new RegExp(`at least ${GameRules.MINIMUM_UNDERDOGS_PER_ROUND} Underdogs every Round`),
      ),
    ).toBeInTheDocument();
  });

  it("works the Margin difference example the way the scoring does", () => {
    render(<HowTippingWorksPage />);
    const won = GameRules.calculateMarginDiff(20, 32, true);
    const lost = GameRules.calculateMarginDiff(20, 32, false);
    expect(
      screen.getByText(
        `Say you tip Geelong by 20. Geelong win by 32: your Margin difference is ${won}. Geelong lose by 32: it's ${lost}.`,
      ),
    ).toBeInTheDocument();
  });
});
