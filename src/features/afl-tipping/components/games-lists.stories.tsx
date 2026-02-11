import preview, { centeredYDecorator, containerDecorator } from "#.storybook/preview";
import { createAflGame, createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";
import { GamesList } from "~/features/afl-tipping/components/games-list";

const meta = preview.meta({
  component: GamesList,
  args: {
    games: [
      createAflGame({ homeTeamId: 1, awayTeamId: 2 }),
      createAflGame({ homeTeamId: 3, awayTeamId: 4 }),
    ],
    teams: [
      createAflTeam({ id: 1, ...fakeTeams.lions }),
      createAflTeam({ id: 2, ...fakeTeams.suns }),
      createAflTeam({ id: 3, ...fakeTeams.COL }),
      createAflTeam({ id: 4, ...fakeTeams.ESS }),
    ],
    onTipSelect: () => {},
  },
  parameters: { layout: "padded" },
  decorators: [containerDecorator("max-w-xl"), centeredYDecorator],
});

export const Demo = meta.story({
  tags: ["demo"],
});
