import {
  getTeamsServerFn,
  getSeasonsServerFn,
  getStandingsServerFn,
  getGamesServerFn,
  getModelTipsServerFn,
} from "~/features/afl-tipping/api/squiggle.serverfns";

export const service = {
  getAllCurrentTeams: () => getTeamsServerFn(),
  getSeasons: () => getSeasonsServerFn(),
  getStandings: (season: number) => getStandingsServerFn({ data: { season } }),
  getGames: (season: number, round?: number) => getGamesServerFn({ data: { season, round } }),
  getModelTips: (season: number, round: number) =>
    getModelTipsServerFn({ data: { season, round } }),
};
