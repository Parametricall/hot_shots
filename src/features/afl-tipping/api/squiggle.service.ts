import {
  fetchAllCurrentTeams,
  fetchGames,
  fetchIncompleteGames,
  fetchStandings,
  fetchTips,
} from "~/features/afl-tipping/api/squiggle/api";

export const service = {
  getAllCurrentTeams: fetchAllCurrentTeams,
  getStandings: fetchStandings,
  getGames: fetchGames,
  getIncompleteGames: fetchIncompleteGames,
  getTIps: fetchTips,
};
