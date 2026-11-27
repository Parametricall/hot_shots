import preview from "#.storybook/preview";
import { DemoSplit } from "~/features/architecture/diagrams/demo-split";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: DemoSplit });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
