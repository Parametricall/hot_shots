import preview, { containerDecorator } from "#.storybook/preview";
import { WoodenSpoon } from "~/components/wooden-spoon";

const meta = preview.meta({
  component: WoodenSpoon,
  decorators: [containerDecorator("max-w-xs")],
  parameters: {
    layout: "centered",
  },
});

export const Default = meta.story({});

export const Small = meta.story({
  args: {
    size: 12,
  },
});

export const Large = meta.story({
  args: {
    size: 64,
  },
});
