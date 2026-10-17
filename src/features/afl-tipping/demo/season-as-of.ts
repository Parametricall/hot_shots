import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import type { AflGame, AflStanding } from "~/features/afl-tipping/types";
import type { LoadedSnapshot } from "./snapshot";

/**
 * A Season as the Demo clock shows it (docs/adr/0004). The snapshot only has
 * final scores, so in the Demo "started" means "finished": every Game at or
 * before the Demo clock shows its result, every later Game shows none.
 */

/** The Game as it is at `at`: unchanged once started, otherwise with every result field reset. */
export function gameAsOf(game: AflGame, at: number): AflGame {
  if (game.unixTime <= at) return game;
  return {
    ...game,
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    complete: 0,
    timeStr: "Not Started",
  };
}

export function gamesAsOf(games: AflGame[], at: number): AflGame[] {
  return games.map((game) => gameAsOf(game, at));
}

/**
 * The Ladder after the latest Round whose every Game has started by `at`.
 * Before any Round is complete every team's record is zeroed, so no result
 * leaks; the teams and their order (by name) come from the Season's last Ladder.
 */
export function standingsAsOf(
  snapshot: Pick<LoadedSnapshot, "standingsAfterRound">,
  games: AflGame[],
  at: number,
): AflStanding[] {
  const rounds = new Map<number, AflGame[]>();
  for (const game of games) {
    rounds.set(game.round, [...(rounds.get(game.round) ?? []), game]);
  }
  const completeRounds = [...rounds]
    .filter(([, roundGames]) => roundGames.every((g) => g.unixTime <= at))
    .map(([round]) => round)
    .filter((round) => snapshot.standingsAfterRound.has(round));

  if (completeRounds.length > 0) {
    return snapshot.standingsAfterRound.get(Math.max(...completeRounds))!;
  }

  const lastRound = Math.max(...snapshot.standingsAfterRound.keys());
  const teams = snapshot.standingsAfterRound.get(lastRound) ?? [];
  return teams
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((team, index): AflStanding => ({
      id: team.id,
      name: team.name,
      rank: index + 1,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      behindsFor: 0,
      behindsAgainst: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      percentage: 0,
    }));
}

/**
 * The made-up Tipsters' Tips that exist at `at`: those on Games up to the
 * current Round (the earliest Round with a Game still to start). The snapshot
 * has Tips for the whole Season, but a real Competition never has Tips for
 * Rounds that have not opened yet, and extra Rounds would show up in the stats.
 */
export function tipsAsOf(tips: AllTipsRow[], games: AflGame[], at: number): AllTipsRow[] {
  const upcoming = games.filter((g) => g.unixTime > at);
  if (upcoming.length === 0) return tips;
  const currentRound = Math.min(...upcoming.map((g) => g.round));
  const roundOfGame = new Map(games.map((g) => [g.id, g.round]));
  return tips.filter((tip) => (roundOfGame.get(tip.game_id) ?? Infinity) <= currentRound);
}
