import preview from "#.storybook/preview";
import { ReadingSequence } from "~/features/architecture/diagrams/reading-sequence";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: ReadingSequence });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
