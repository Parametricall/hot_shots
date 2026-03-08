// Abstraction for AFL tipping game rules

import { AflGame } from "~/features/afl-tipping/types";

export interface CanSubmitTipParams {
  game: AflGame;
}

export const GameRules = {
  canSubmitTip({ game }: CanSubmitTipParams): boolean {
    return !AflGame.hasStarted(game);
  },

  /**
   * Returns the actual winning margin for a completed game, or null if the game
   * is not complete or scores are unavailable.
   */
  getActualMargin(game: AflGame): number | null {
    if (!AflGame.isComplete(game) || game.homeScore === null || game.awayScore === null) {
      return null;
    }
    return Math.abs(game.homeScore - game.awayScore);
  },

  /**
   * Calculates how far off a user's margin tip was from the actual result.
   * If the tipped team won: absolute difference between predicted and actual margin.
   * If the tipped team lost: actual margin + predicted margin (they were wrong on both direction and size).
   */
  calculateMarginDiff(tipMargin: number, actualMargin: number, tippedTeamWon: boolean): number {
    if (tippedTeamWon) {
      return Math.abs(tipMargin - actualMargin);
    }
    return actualMargin + tipMargin;
  },
};
