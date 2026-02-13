import preview, { containerDecorator } from "#.storybook/preview";
import { Index } from "~/pages/afl-tipping/index/index";
import { AflStanding, AflTeam } from "~/features/afl-tipping/types";
import { createAflGame, createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";

const GAMES = [
  createAflGame({ id: 0 }),
  createAflGame({ id: 1 }),
  createAflGame({ id: 2, round: 1, roundName: "Round 1" }),
  createAflGame({ id: 3, round: 2, roundName: "Round 2" }),
];

const meta = preview.meta({
  component: Index,
  decorators: [containerDecorator("max-w-xl mx-auto")],
});

export const Demo = meta.story({
  tags: ["demo"],
  args: {
    view: "standings",
  },
  parameters: {
    services: {
      aflService: {
        getTips: () => {
          return { tipTeamId: 1 };
        },
        submitTip: () => {
          return { success: true };
        },
      },
      squiggleService: {
        getAllCurrentTeams: async () => {
          return [
            createAflTeam({ id: 1, ...fakeTeams.LIONS }),
            createAflTeam({ id: 2, ...fakeTeams.SUNS }),
          ] satisfies AflTeam[];
        },
        getStandings: async () => {
          return [
            {
              id: 1,
              name: "Lions",
              rank: 1,
              played: 14,
              wins: 10,
              losses: 3,
              draws: 1,
              points: 42,
              goalsFor: 150,
              goalsAgainst: 120,
              behindsFor: 95,
              behindsAgainst: 80,
              pointsFor: 995,
              pointsAgainst: 800,
              percentage: 124.4,
            },
          ] satisfies AflStanding[];
        },
        getGames: async (round: number) => {
          if (round != undefined) return GAMES.filter((g) => g.round == round);
          return GAMES;
        },
        getIncompleteGames: async () => {
          return [];
        },
      },
    },
  },
});
