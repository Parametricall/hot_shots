import preview, { containerDecorator, centeredYDecorator } from "#.storybook/preview";
import { QueryErrorFallback } from "~/components/QueryErrorResetBoundary";
import { fn } from "storybook/test";

const meta = preview.meta({
  component: QueryErrorFallback,
  decorators: [containerDecorator("max-w-2xl"), centeredYDecorator],
});

export default meta;

export const Default = meta.story({
  args: {
    error: new Error("Failed to fetch data from the Squiggle API"),
    onRetry: fn(),
  },
});

export const NetworkError = meta.story({
  args: {
    error: new Error("Network request failed. Please check your connection."),
    onRetry: fn(),
  },
});

export const GenericError = meta.story({
  args: {
    error: new Error(""),
    onRetry: fn(),
  },
});
