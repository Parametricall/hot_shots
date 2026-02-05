// Abstraction for AFL tipping game rules

import { AflGame } from "~/features/afl-tipping/types";

export interface CanSubmitTipParams {
  game: AflGame;
}

export const GameRules = {
  canSubmitTip({ game }: CanSubmitTipParams): boolean {
    return !AflGame.hasStarted(game);
  },
  // Future rules can be added here
};
