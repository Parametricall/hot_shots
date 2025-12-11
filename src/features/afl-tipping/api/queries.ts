import {queryOptions} from "@tanstack/react-query";
import ServiceRegistry from '~/service-registry'

export const aflQueries = {
    aflKey: () => ["afl"] as const,
    allTeamsKey: () => [...aflQueries.aflKey(), "teams"] as const,
    teams: () => {
        const {getAllCurrentTeams} = ServiceRegistry.getService('squiggleService')
        return queryOptions({
            queryKey: aflQueries.allTeamsKey(),
            queryFn: getAllCurrentTeams,
            staleTime: Infinity, // Teams rarely change, so we can cache them indefinitely
        })
    },
    allStandingsKey: () => [...aflQueries.aflKey(), "standings"] as const,
    standings: () => {
        const {getStandings} = ServiceRegistry.getService('squiggleService')
        return queryOptions({
            queryKey: aflQueries.allStandingsKey(),
            queryFn: getStandings,
            staleTime: 1000 * 60 * 60, // Cache standings for 1 hour
        })
    },
    allGamesKey: () => [...aflQueries.aflKey(), "games"] as const,
    allGames: () => {
        const {getStandings} = ServiceRegistry.getService('squiggleService')
        return queryOptions({
            queryKey: aflQueries.allGamesKey(),
            queryFn: getStandings,
            staleTime: Infinity,
        })
    },
    games: (round?: number) => {
        const {getGames} = ServiceRegistry.getService('squiggleService')
        return queryOptions({
            queryKey: [...aflQueries.allGamesKey(), {round}],
            queryFn: () => getGames(round),
            staleTime: 1000 * 60 * 5, // Cache games for 5 minutes
        })
    },
    allIncompleteGamesKey: () =>
        [...aflQueries.allGamesKey(), "incompleteGames"] as const,
    incompleteGames: () => {
        const {getIncompleteGames} = ServiceRegistry.getService('squiggleService')
        return queryOptions({
            queryKey: [...aflQueries.allIncompleteGamesKey()],
            queryFn: getIncompleteGames,
            staleTime: 1000 * 60, // Cache incomplete games for 1 hour
        })
    },
    allTipsKey: () => [...aflQueries.aflKey(), "tips"],
    tips: (round: number) => {
        const {getTIps} = ServiceRegistry.getService('squiggleService')
        return queryOptions({
            queryKey: [...aflQueries.allTipsKey(), {round}],
            queryFn: () => getTIps(round),
            staleTime: 1000 * 60 * 60, // Cache tips for 1 hour
        })
    },
};
