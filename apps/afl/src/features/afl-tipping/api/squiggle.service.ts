import {
  getTeamsServerFn,
  getStandingsServerFn,
  getGamesServerFn,
  getIncompleteGamesServerFn,
  getModelTipsServerFn,
} from "~/features/afl-tipping/api/squiggle.serverfns";

export const service = {
  getAllCurrentTeams: () => getTeamsServerFn(),
  getStandings: () => getStandingsServerFn(),
  getGames: (round?: number) => getGamesServerFn({ data: { round } }),
  getIncompleteGames: () => getIncompleteGamesServerFn(),
  getModelTips: (round: number) => getModelTipsServerFn({ data: { round } }),
};
