import preview from "#.storybook/preview";
import { Arrowheads } from "~/features/architecture/diagram/arrowheads";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

/** `Diagram` renders `Arrowheads`; this shows the three heads it defines, on their Edges. */
const meta = preview.meta({
  component: Arrowheads,
  args: { ids: { normal: "n", highlighted: "h", refused: "r" } },
  render: () => (
    <Diagram viewBox="0 0 220 110" label="The three arrowhead colors" minWidth={220}>
      <Edge x1={10} y1={20} x2={200} y2={20} />
      <Edge x1={10} y1={55} x2={200} y2={55} highlighted both />
      <Edge x1={10} y1={90} x2={200} y2={90} refused />
    </Diagram>
  ),
});

export const NormalHighlightedRefused = meta.story();

export const NormalHighlightedRefusedDark = meta.story({ decorators: [darkDecorator] });
