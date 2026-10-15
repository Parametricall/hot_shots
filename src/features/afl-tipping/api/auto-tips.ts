import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import type { AllTipsRow } from "./tips.repository";

export type AutoTip = { gameId: number; userId: string; tipTeamId: number };

/**
 * The Auto-tips owed for `games`: one per Tipster per started Game they joined
 * before and haven't tipped, on the Home team (docs/adr/0001).
 *
 * Auto-tips are computed on read and never stored. Every reader that adds up
 * Tips (Leaderboard, stats, Player Tips, My Tips) goes through this function.
 */
export function findAutoTips(args: {
  games: AflGame.Type[];
  tips: { game_id: number; user_id: string }[];
  joinedAtByTipster: Map<string, number>; // userId → joined-at, epoch ms
  now: number; // epoch ms; pass Date.now() in production
}): AutoTip[] {
  const { games, tips, joinedAtByTipster, now } = args;
  const tipped = new Set(tips.map((t) => `${t.game_id}:${t.user_id}`));
  const autoTips: AutoTip[] = [];

  for (const game of games) {
    if (now < game.unixTime || game.homeTeamId == null) continue;
    for (const [userId, joinedAt] of joinedAtByTipster) {
      if (joinedAt >= game.unixTime) continue;
      if (tipped.has(`${game.id}:${userId}`)) continue;
      autoTips.push({ gameId: game.id, userId, tipTeamId: game.homeTeamId });
    }
  }
  return autoTips;
}

/**
 * An Auto-tip shaped as a stored row, so scorers treat it like any other Tip.
 * No Margin (scored as 0) and no underdog status: the one place Auto-tips get
 * their values.
 */
export function toAutoTipRow(autoTip: AutoTip, game: AflGame.Type): AllTipsRow {
  return {
    game_id: autoTip.gameId,
    user_id: autoTip.userId,
    tip: autoTip.tipTeamId,
    margin: null,
    is_underdog: null,
    is_auto_tip: true,
    created_at: new Date(game.unixTime).toISOString(),
  };
}
