import {
  getTeamsServerFn,
  getStandingsServerFn,
  getGamesServerFn,
  getIncompleteGamesServerFn,
  getModelTipsServerFn,
} from "~/features/afl-tipping/api/squiggle.server";

export const service = {
  getAllCurrentTeams: () => getTeamsServerFn(),
  getStandings: () => getStandingsServerFn(),
  getGames: (round?: number) => getGamesServerFn({ data: { round } }),
  getIncompleteGames: () => getIncompleteGamesServerFn(),
  getModelTips: (round: number) => getModelTipsServerFn({ data: { round } }),
};
