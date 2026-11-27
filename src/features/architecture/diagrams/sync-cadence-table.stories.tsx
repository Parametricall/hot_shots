import preview from "#.storybook/preview";
import { SyncCadenceTable } from "~/features/architecture/diagrams/sync-cadence-table";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({ component: SyncCadenceTable });

export const Light = meta.story({ decorators: [lightDecorator] });

export const Dark = meta.story({ decorators: [darkDecorator] });
