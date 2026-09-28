import preview, { withRouter } from "#.storybook/preview";
import { HubPage } from "~/features/hub/pages/hub";

const meta = preview.meta({
  component: HubPage,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withRouter],
});

export const Default = meta.story({});
