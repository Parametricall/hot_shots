import preview, {
  centeredYDecorator,
  containerDecorator,
} from "#.storybook/preview";
import { GameCard } from "~/features/afl-tipping/components/game-card";
import {
  createAflGame,
  createAflTeam,
  fakeTeams,
} from "~/features/afl-tipping/mocks/factories";

const meta = preview.meta({
  component: GameCard,
  args: {
    game: createAflGame({ homeTeamId: 1, awayTeamId: 2 }),
    homeTeam: createAflTeam({ id: 1, ...fakeTeams.lions }),
    awayTeam: createAflTeam({ id: 2, ...fakeTeams.suns }),
  },
  parameters: { layout: "padded" },
  decorators: [containerDecorator("max-w-xl"), centeredYDecorator],
});

export const Demo = meta.story({
  tags: ["demo"],
  render: (args) => {
    return <GameCard {...args} />;
  },
});

export const HomeTeamSelected = meta.story({
  args: {},
});

export const AwayTeamSelected = meta.story({
  args: {},
});
