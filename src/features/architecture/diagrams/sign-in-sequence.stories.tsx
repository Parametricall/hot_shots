import preview from "#.storybook/preview";
import { SignInSequence } from "~/features/architecture/diagrams/sign-in-sequence";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: SignInSequence });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
