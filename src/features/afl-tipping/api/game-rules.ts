// Abstraction for AFL tipping game rules

import * as AflGame from "~/features/afl-tipping/utils/afl-game";

export type CanSubmitTipParams = {
  game: AflGame.Type;
  now?: number; // epoch ms; defaults to the site clock
};

export const GameRules = {
  canSubmitTip({ game, now }: CanSubmitTipParams): boolean {
    return !AflGame.hasStarted(game, now);
  },

  /**
   * Returns the actual winning margin for a completed game, or null if the game
   * is not complete or scores are unavailable.
   */
  getActualMargin(game: AflGame.Type): number | null {
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

  MINIMUM_UNDERDOGS_PER_ROUND: 2,
};
