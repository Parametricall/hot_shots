import preview, { containerDecorator, centeredYDecorator } from "#.storybook/preview";
import { GameCardSkeleton } from "~/features/afl-tipping/pages/my-tips";
import { TippingPageSkeleton } from "~/features/afl-tipping/components/tipping-page-shell";

const meta = preview.meta({
  decorators: [containerDecorator("max-w-2xl"), centeredYDecorator],
});

export default meta;

export const FullPage = meta.story({
  render: () => (
    <TippingPageSkeleton>
      {Array.from({ length: 4 }).map((_, i) => (
        <GameCardSkeleton key={i} showMargin={i === 0} />
      ))}
    </TippingPageSkeleton>
  ),
});
