import preview from "#.storybook/preview";
import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: Box,
  args: {
    x: 10,
    y: 10,
    width: 210,
    height: 56,
    title: "Query cache",
    lines: ["localStorage · kept 24 h"],
  },
  render: (args) => (
    <Diagram viewBox="0 0 240 80" label="A box" minWidth={240}>
      <Box {...args} />
    </Diagram>
  ),
});

export const Default = meta.story();

export const Highlighted = meta.story({ args: { highlighted: true } });

export const External = meta.story({
  args: { external: true, title: "Standard API", lines: ["games · tips · ladder"] },
});

export const Soft = meta.story({ args: { soft: true } });

export const MonoLines = meta.story({
  args: { title: "Squiggle sync", lines: ["api/sync/squiggle"], mono: true },
});

export const TitleOnly = meta.story({
  args: { height: 36, title: "Browser", lines: undefined, centered: true },
});

export const HighlightedDark = meta.story({
  args: { highlighted: true },
  decorators: [darkDecorator],
});

export const ExternalDark = meta.story({
  args: { external: true },
  decorators: [darkDecorator],
});
