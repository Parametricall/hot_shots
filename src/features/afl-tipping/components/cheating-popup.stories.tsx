import preview, { centeredYDecorator } from "#.storybook/preview";
import { CheatingPopup } from "~/features/afl-tipping/components/cheating-popup";
import { expect, within, waitFor, userEvent } from "storybook/test";

const meta = preview.meta({
  component: CheatingPopup,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [centeredYDecorator],
});

export const Default = meta.story({
  tags: ["demo"],
  args: { reportCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("Cheating detected")).toBeInTheDocument();
    });
    expect(canvas.getByText(/3 reports filed against you/)).toBeInTheDocument();
    expect(canvas.getByText("I'm innocent")).toBeInTheDocument();
    expect(canvas.getByText("Okay fine, I cheated")).toBeInTheDocument();
  },
});

export const SingleReport = meta.story({
  args: { reportCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/1 report filed against you/)).toBeInTheDocument();
    });
  },
});

export const InnocentPath = meta.story({
  args: { reportCount: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Step 1
    await waitFor(() => {
      expect(canvas.getByText("Cheating detected")).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByText("I'm innocent"));

    // Step 2
    await waitFor(() => {
      expect(canvas.getByText("Are you sure about that?")).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByText("Yes, completely innocent"));

    // Step 3
    await waitFor(() => {
      expect(canvas.getByText("One final question")).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByText("I pinky promise I did not cheat"));

    // Innocent screen
    await waitFor(() => {
      expect(canvas.getByText("Noted... we're watching")).toBeInTheDocument();
    });
    expect(canvas.getByText("Close")).toBeInTheDocument();
  },
});

export const GuiltyPath = meta.story({
  args: { reportCount: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Step 1 -> guilty
    await waitFor(() => {
      expect(canvas.getByText("Cheating detected")).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByText("Okay fine, I cheated"));

    // Guilty screen
    await waitFor(() => {
      expect(canvas.getByText("Confession accepted")).toBeInTheDocument();
    });
    expect(
      canvas.getByText("Your honesty has been noted. The tribunal will be in touch."),
    ).toBeInTheDocument();

    // Loop back to step 1
    await userEvent.click(canvas.getByText("Wait, I didn't mean it"));
    await waitFor(() => {
      expect(canvas.getByText("Cheating detected")).toBeInTheDocument();
    });
  },
});
