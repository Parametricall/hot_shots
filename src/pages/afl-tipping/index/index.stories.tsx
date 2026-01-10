import preview, { containerDecorator } from "#.storybook/preview";
import { Index } from "~/pages/afl-tipping/index/index";
import { AflStanding, AflTeam } from "~/features/afl-tipping/types";
import {
  createAflGame,
  createAflTeam,
  fakeTeams,
} from "~/features/afl-tipping/mocks/factories";
import { AflServerFnsContext } from "~/features/afl-tipping/providers/afl-server-fns-provider";

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
  decorators: [
    (Story) => (
      <AflServerFnsContext
        value={{
          // @ts-expect-error - wip
          submitTip: (payload) => {
            console.log(payload);
          },
        }}
      >
        <Story />
      </AflServerFnsContext>
    ),
  ],
});
