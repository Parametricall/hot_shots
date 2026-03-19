import preview, { centeredYDecorator, containerDecorator } from "#.storybook/preview";
import { Standings } from "~/features/afl-tipping/components/standings";
import { createAflStanding, createAflTeam } from "~/features/afl-tipping/mocks/factories";

const TEAMS = [
  createAflTeam({ id: 1, name: "Brisbane Lions", abbrev: "BRL" }),
  createAflTeam({ id: 2, name: "Carlton Blues", abbrev: "CAR" }),
  createAflTeam({ id: 3, name: "Collingwood Magpies", abbrev: "COL" }),
  createAflTeam({ id: 4, name: "Essendon Bombers", abbrev: "ESS" }),
  createAflTeam({ id: 5, name: "Geelong Cats", abbrev: "GEE" }),
  createAflTeam({ id: 6, name: "Richmond Tigers", abbrev: "RIC" }),
];

const STANDINGS = [
  createAflStanding({
    id: 1,
    name: "Brisbane Lions",
    rank: 1,
    wins: 8,
    losses: 2,
    draws: 0,
    points: 32,
    percentage: 142.5,
  }),
  createAflStanding({
    id: 2,
    name: "Carlton Blues",
    rank: 2,
    wins: 7,
    losses: 3,
    draws: 0,
    points: 28,
    percentage: 125.3,
  }),
  createAflStanding({
    id: 3,
    name: "Collingwood Magpies",
    rank: 3,
    wins: 6,
    losses: 3,
    draws: 1,
    points: 26,
    percentage: 118.7,
  }),
  createAflStanding({
    id: 4,
    name: "Essendon Bombers",
    rank: 4,
    wins: 5,
    losses: 4,
    draws: 1,
    points: 22,
    percentage: 105.2,
  }),
  createAflStanding({
    id: 5,
    name: "Geelong Cats",
    rank: 5,
    wins: 4,
    losses: 6,
    draws: 0,
    points: 16,
    percentage: 92.1,
  }),
  createAflStanding({
    id: 6,
    name: "Richmond Tigers",
    rank: 6,
    wins: 2,
    losses: 8,
    draws: 0,
    points: 8,
    percentage: 74.6,
  }),
];

const standingsServices = (standings: typeof STANDINGS, teams: typeof TEAMS) => ({
  squiggleService: {
    getStandings: async () => standings,
    getAllCurrentTeams: async () => teams,
  },
});

const meta = preview.meta({
  component: Standings,
  parameters: {
    layout: "padded",
    services: standingsServices(STANDINGS, TEAMS),
  },
  decorators: [containerDecorator("max-w-2xl"), centeredYDecorator],
});

export const Default = meta.story({
  tags: ["demo"],
});

export const Loading = meta.story({
  parameters: {
    services: {
      squiggleService: {
        getStandings: () => new Promise(() => {}),
        getAllCurrentTeams: () => new Promise(() => {}),
      },
    },
  },
});

export const Error = meta.story({
  parameters: {
    services: {
      squiggleService: {
        getStandings: () => Promise.reject(new globalThis.Error("Network error")),
        getAllCurrentTeams: async () => TEAMS,
      },
    },
  },
});

export const ErrorThenRetry = meta.story({
  parameters: {
    services: {
      squiggleService: {
        getStandings: (() => {
          let calls = 0;
          return () => {
            calls++;
            if (calls <= 1) {
              return Promise.reject(new globalThis.Error("Network error"));
            }
            return new Promise((resolve) => setTimeout(() => resolve(STANDINGS), 1500));
          };
        })(),
        getAllCurrentTeams: async () => TEAMS,
      },
    },
  },
});
