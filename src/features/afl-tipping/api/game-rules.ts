// Abstraction for AFL tipping game rules

import * as AflGame from "~/features/afl-tipping/utils/afl-game";

export interface CanSubmitTipParams {
  game: AflGame.Type;
}

export const GameRules = {
  canSubmitTip({ game }: CanSubmitTipParams): boolean {
    return !AflGame.hasStarted(game);
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

  /**
   * A round is considered finals if it has fewer than 9 games.
   * The underdog tipping rule is not applied during finals rounds.
   */
  isFinals(gamesInRound: AflGame.Type[]): boolean {
    return gamesInRound.length < 9;
  },

  MINIMUM_UNDERDOGS_PER_ROUND: 2,
};
