import preview from "#.storybook/preview";
import { LiveFlow } from "~/features/architecture/diagrams/live-flow";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: LiveFlow });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
