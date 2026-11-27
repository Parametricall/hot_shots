import preview from "#.storybook/preview";
import { LiveTimeline } from "~/features/architecture/diagrams/live-timeline";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: LiveTimeline });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
