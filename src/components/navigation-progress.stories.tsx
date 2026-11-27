import preview from "#.storybook/preview";
import { NavigationProgressBar } from "~/components/navigation-progress";

const meta = preview.meta({
  component: NavigationProgressBar,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    active: true,
  },
});

/** Hidden for the first 150 ms, then creeping across. Reload the story to watch it again. */
export const Active = meta.story({});

export const Idle = meta.story({
  args: {
    active: false,
  },
});
