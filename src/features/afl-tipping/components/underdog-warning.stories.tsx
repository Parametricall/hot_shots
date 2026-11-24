import preview, { containerDecorator } from "#.storybook/preview";
import { UnderdogChip } from "~/features/afl-tipping/components/underdog-warning";

const meta = preview.meta({
  component: UnderdogChip,
  decorators: [containerDecorator("max-w-sm flex flex-wrap items-center gap-2")],
  args: { count: 1, hasModelTips: true, isFinals: false },
});

export const BelowTheQuota = meta.story();

export const QuotaMet = meta.story({ args: { count: 2 } });

/** Nothing shows in Finals, or before the Model has tipped: the stories render empty. */
export const HiddenInFinals = meta.story({ args: { isFinals: true } });

export const HiddenBeforeTheModelTips = meta.story({ args: { count: 0, hasModelTips: false } });
