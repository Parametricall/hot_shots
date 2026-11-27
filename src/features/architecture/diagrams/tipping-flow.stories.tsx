import preview from "#.storybook/preview";
import { TippingFlow } from "~/features/architecture/diagrams/tipping-flow";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: TippingFlow });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
