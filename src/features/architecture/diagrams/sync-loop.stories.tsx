import preview from "#.storybook/preview";
import { SyncLoop } from "~/features/architecture/diagrams/sync-loop";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: SyncLoop });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
