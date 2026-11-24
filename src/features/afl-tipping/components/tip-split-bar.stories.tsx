import preview, { containerDecorator } from "#.storybook/preview";
import { TipSplitBar } from "~/features/afl-tipping/components/tip-split-bar";
import { createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";

const meta = preview.meta({
  component: TipSplitBar,
  decorators: [containerDecorator("max-w-sm")],
  args: {
    homeTeam: createAflTeam({ id: 1, ...fakeTeams.COL }),
    awayTeam: createAflTeam({ id: 2, ...fakeTeams.ESS }),
    homeCount: 9,
    awayCount: 4,
  },
});

export const WithModelTipOnTheFavourite = meta.story({ args: { modelTipTeamId: 1 } });

export const WithModelTipOnTheUnderdog = meta.story({ args: { modelTipTeamId: 2 } });

export const NoModelTip = meta.story();

export const Even = meta.story({ args: { homeCount: 5, awayCount: 5, modelTipTeamId: 2 } });

export const Unanimous = meta.story({ args: { homeCount: 12, awayCount: 0, modelTipTeamId: 2 } });
