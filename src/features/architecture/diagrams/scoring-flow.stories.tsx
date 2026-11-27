import preview from "#.storybook/preview";
import { ScoringFlow } from "~/features/architecture/diagrams/scoring-flow";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: ScoringFlow });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
