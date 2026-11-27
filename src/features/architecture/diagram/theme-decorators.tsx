import type { Decorator } from "@storybook/react-vite";

/** Runs the story under the app's `.dark` class, which the tokens and the `dark:` variant key on. */
export const darkDecorator: Decorator = (Story) => (
  <div className="dark bg-background p-4 text-foreground">
    <Story />
  </div>
);

export const lightDecorator: Decorator = (Story) => (
  <div className="bg-background p-4 text-foreground">
    <Story />
  </div>
);
