import preview, { containerDecorator } from "#.storybook/preview";
import { HowTippingWorksPage } from "~/features/afl-tipping/pages/how-tipping-works";

const meta = preview.meta({
  component: HowTippingWorksPage,
  parameters: { layout: "padded" },
  globals: { viewport: { value: "mobile1" } },
  decorators: [containerDecorator("max-w-md")],
});

export const OnAPhone = meta.story({});
