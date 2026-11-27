import preview from "#.storybook/preview";
import { SecurityBoundaries } from "~/features/architecture/diagrams/security-boundaries";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: SecurityBoundaries });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
