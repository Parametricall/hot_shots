import { AflGame, AflTeam } from "~/features/afl-tipping/types";
import { VENUES } from "~/features/afl-tipping/constants";

export const fakeTeams: Record<string, Pick<AflTeam, "name" | "abbrev">> = {
  lions: {
    name: "Lions",
    abbrev: "LIO",
  },
  suns: {
    name: "Suns",
    abbrev: "SUN",
  },
  COL: {
    name: "Collingwood",
    abbrev: "COL",
  },
  ESS: {
    name: "Essendon",
    abbrev: "ESS",
  },
};

export function createAflTeam(overrides: Partial<AflTeam> = {}): AflTeam {
  return {
    id: 1,
    ...fakeTeams.lions,
    logo: "/dummy-footy-logo.png",
    debut: 1897,
    ...overrides,
  };
}

export function createAflGame(overrides: Partial<AflGame> = {}) {
  const futureTime = Date.now() + 1000 * 60 * 60 * 24; // 24 hours in future
  return {
    id: 0,
    round: 0,
    roundName: "Round 1",
    venue: VENUES.gabba,
    unixTime: futureTime,
    date: new Date(futureTime),
    homeTeamId: 1,
    awayTeamId: 2,
    timeStr: "Q4  4:16",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    ...overrides,
  };
}
