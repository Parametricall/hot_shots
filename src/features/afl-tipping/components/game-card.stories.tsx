import preview, {
  centeredYDecorator,
  containerDecorator,
} from "#.storybook/preview";
import {
  GameCard,
  GameCardSimple,
} from "~/features/afl-tipping/components/game-card";
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
    onTipSelect: () => {},
  },
  parameters: { layout: "padded" },
  decorators: [containerDecorator("max-w-xl"), centeredYDecorator],
});

export const Demo = meta.story({
  tags: ["demo"],
});

export const HomeTeamSelected = meta.story({
  args: {
    tip: {
      tipTeamId: 1,
    },
  },
});

export const AwayTeamSelected = meta.story({
  args: {},
});

export const Test = meta.story({
  render: (args) => {
    return <GameCardSimple {...args} />;
  },
});
