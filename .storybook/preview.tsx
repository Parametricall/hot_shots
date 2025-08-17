import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import type { Decorator } from "@storybook/react-vite";
import { definePreview } from "@storybook/react-vite";

import "~/styles/app.css";
import { HTMLProps } from "react";
import { cn } from "~/lib/utils";

export const containerDecorator = (
  className: HTMLProps<HTMLElement>["className"],
) => {
  const Decorated: Decorator = (Story) => (
    <div className={cn("w-full", className)}>
      <Story />
    </div>
  );
  return Decorated;
};

export const centeredYDecorator: Decorator = (Story) => {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <Story />
    </div>
  );
};

export default definePreview({
  parameters: {
    layout: "none",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  addons: [addonDocs(), addonA11y()],
});
