import preview, {
  centeredYDecorator,
  containerDecorator,
} from "#.storybook/preview";
import { Index } from "~/pages/afl-tipping/index/index";
import { AflStanding, AflTeam } from "~/features/afl-tipping/types";
import {
  createAflGame,
  createAflTeam,
  fakeTeams,
} from "~/features/afl-tipping/mocks/factories";
import { AflServerFnsContext } from "~/features/afl-tipping/providers/afl-server-fns-provider";
import { RouterProvider } from "@tanstack/react-router";
import { routeTree } from "~/routeTree.gen";

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
        getGames: async () => {
          return [
            createAflGame({ id: 1 }),
            createAflGame({ id: 2 }),
            createAflGame({ id: 3 }),
            createAflGame({ id: 4 }),
          ];
        },
      },
    },
  },
  decorators: [
    (Story) => (
      <AflServerFnsContext
        value={{
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
