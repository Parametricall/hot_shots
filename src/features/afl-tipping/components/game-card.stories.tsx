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
import { useState } from "react";

const meta = preview.meta({
  component: GameCard,
  args: {
    game: createAflGame({ homeTeamId: 1, awayTeamId: 2 }),
    homeTeam: createAflTeam({ id: 1, ...fakeTeams.lions }),
    awayTeam: createAflTeam({ id: 2, ...fakeTeams.suns }),
    selectedTip: undefined,
    onTipSelect: () => {},
  },
  parameters: { layout: "padded" },
  decorators: [containerDecorator("max-w-xl"), centeredYDecorator],
});

export const Demo = meta.story({
  tags: ["demo"],
  render: (args) => {
    const [tip, setTip] = useState<number | undefined>(undefined);
    return (
      <GameCard
        {...args}
        selectedTip={tip}
        onTipSelect={(_, teamId) => setTip(teamId)}
      />
    );
  },
});

export const HomeTeamSelected = meta.story({
  args: {
    selectedTip: 1,
  },
});

export const AwayTeamSelected = meta.story({
  args: {
    selectedTip: 2,
  },
});
