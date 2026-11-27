import preview from "#.storybook/preview";
import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: Diagram,
  args: {
    viewBox: "0 0 400 80",
    label: "Two boxes and an arrow",
    minWidth: 640,
    children: (
      <>
        <Box x={10} y={12} width={150} height={56} title="Pages" lines={["React"]} />
        <Box x={240} y={12} width={150} height={56} title="Server" lines={["TanStack Start"]} />
        <Edge x1={160} y1={40} x2={240} y2={40} />
      </>
    ),
  },
});

export const Default = meta.story();

/** Narrower than `minWidth`, so the wrapper scrolls instead of shrinking the SVG. */
export const ScrollsOnAPhone = meta.story({
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
});

/** Each Diagram makes its own marker ids, so the second one's arrowheads still draw. */
export const TwoDiagramsOnOnePage = meta.story({
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <Story />
        <Story />
      </div>
    ),
  ],
});

export const Dark = meta.story({ decorators: [darkDecorator] });
