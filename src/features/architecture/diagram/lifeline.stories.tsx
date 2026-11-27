import preview from "#.storybook/preview";
import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { Activation, Lifeline } from "~/features/architecture/diagram/lifeline";
import { darkDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: Lifeline,
  args: { x: 70, y1: 44, y2: 170 },
  render: (args) => (
    <Diagram viewBox="0 0 400 180" label="Two lifelines with a call between them" minWidth={400}>
      <Box x={0} y={8} width={140} height={36} title="Browser" centered />
      <Box x={260} y={8} width={140} height={36} title="Supabase" centered />
      <Lifeline {...args} />
      <Lifeline x={330} y1={args.y1} y2={args.y2} />
      <Activation x={70} y={60} height={28} />
      <Edge x1={76} y1={100} x2={324} y2={100} />
      <EdgeLabel x={200} y={92} anchor="middle">
        1. Ask
      </EdgeLabel>
      <Edge x1={324} y1={140} x2={76} y2={140} ret />
      <EdgeLabel x={200} y={132} anchor="middle">
        rows
      </EdgeLabel>
    </Diagram>
  ),
});

export const Sequence = meta.story();

export const SequenceDark = meta.story({ decorators: [darkDecorator] });
