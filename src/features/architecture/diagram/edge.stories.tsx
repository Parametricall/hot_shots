import preview from "#.storybook/preview";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: Edge,
  args: { x1: 10, y1: 30, x2: 200, y2: 30 },
  render: (args) => (
    <Diagram viewBox="0 0 220 60" label="An edge" minWidth={220}>
      <Edge {...args} />
    </Diagram>
  ),
});

export const Default = meta.story();

export const Return = meta.story({ args: { ret: true } });

export const Both = meta.story({ args: { both: true } });

export const Highlighted = meta.story({ args: { highlighted: true } });

export const Refused = meta.story({ args: { refused: true } });

export const Path = meta.story({
  args: { x1: undefined, y1: undefined, x2: undefined, y2: undefined, d: "M10 50 H60 V10 H200" },
});

export const DefaultDark = meta.story({ decorators: [darkDecorator] });

export const HighlightedDark = meta.story({
  args: { highlighted: true },
  decorators: [darkDecorator],
});

export const RefusedDark = meta.story({ args: { refused: true }, decorators: [darkDecorator] });
