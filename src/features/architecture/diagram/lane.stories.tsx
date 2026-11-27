import preview from "#.storybook/preview";
import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Lane } from "~/features/architecture/diagram/lane";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: Lane,
  args: { x: 0, y: 0, width: 250, height: 100, label: "BROWSER" },
  render: (args) => (
    <Diagram viewBox="0 0 250 100" label="A lane" minWidth={250}>
      <Lane {...args} />
      <Box x={20} y={36} width={210} height={50} title="Pages" lines={["React + TanStack Query"]} />
    </Diagram>
  ),
});

export const Default = meta.story();

export const External = meta.story({ args: { external: true, label: "SQUIGGLE · NOT OURS" } });

export const DefaultDark = meta.story({ decorators: [darkDecorator] });
