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
  return {
    id: 1,
    round: 1,
    roundName: "Round 1",
    venue: VENUES.gabba,
    unixTime: Date.now(),
    date: new Date(),
    homeTeamId: 1,
    awayTeamId: 2,
    timeStr: "Q4  4:16",
    ...overrides,
  };
}
