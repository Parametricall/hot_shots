import preview from "#.storybook/preview";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: EdgeLabel,
  args: { x: 110, y: 34, anchor: "middle" as const, children: null },
  render: (args) => (
    <Diagram viewBox="0 0 220 60" label="A labelled edge" minWidth={220}>
      <Edge x1={10} y1={30} x2={210} y2={30} />
      <EdgeLabel {...args}>refetch if over a minute old</EdgeLabel>
    </Diagram>
  ),
});

export const OnTheLine = meta.story();

export const OnTheLineDark = meta.story({ decorators: [darkDecorator] });
