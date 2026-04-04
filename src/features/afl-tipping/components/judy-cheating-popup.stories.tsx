import preview, { withMockUser } from "#.storybook/preview";
import { JudyCheatingPopup } from "~/features/afl-tipping/components/judy-cheating-popup";
import { createAflLeaderboardEntry } from "~/features/afl-tipping/mocks/factories";
import { expect, within, waitFor, userEvent } from "storybook/test";

const JUDY_USER_ID = "user-judy";

const mockLeaderboard = [
  createAflLeaderboardEntry({ userId: "user-alex", displayName: "Alex Smith", score: 12 }),
  createAflLeaderboardEntry({ userId: "user-ryan", displayName: "Ryan Jones", score: 10 }),
  createAflLeaderboardEntry({
    userId: JUDY_USER_ID,
    displayName: "Judy Williams",
    score: 8,
  }),
  createAflLeaderboardEntry({ userId: "user-sam", displayName: "Sam Taylor", score: 7 }),
];

const meta = preview.meta({
  component: JudyCheatingPopup,
  parameters: {
    layout: "fullscreen",
    services: {
      aflService: {
        getLeaderboard: async () => mockLeaderboard,
      },
    },
  },
  decorators: [
    withMockUser({
      id: JUDY_USER_ID,
      fullName: "Judy Williams",
      firstName: "Judy",
      lastName: "Williams",
    }),
  ],
});

export const Default = meta.story({
  tags: ["demo"],
  args: { reportCount: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("You've been reported for cheating!")).toBeInTheDocument();
    });
    expect(canvas.getByText(/2 reports filed against you/)).toBeInTheDocument();
    expect(canvas.getByText(/distribute 3 penalty points/)).toBeInTheDocument();
    // Judy herself should NOT appear in the player list
    expect(canvas.queryByText("Judy Williams")).not.toBeInTheDocument();
    // Other players should appear
    expect(canvas.getByText("Alex Smith")).toBeInTheDocument();
    expect(canvas.getByText("Ryan Jones")).toBeInTheDocument();
    expect(canvas.getByText("Sam Taylor")).toBeInTheDocument();
    // OK button should be disabled
    expect(canvas.getByRole("button", { name: "OK" })).toBeDisabled();
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

export const DistributePoints = meta.story({
  args: { reportCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("You've been reported for cheating!")).toBeInTheDocument();
    });

    // OK should be disabled initially
    expect(canvas.getByRole("button", { name: "OK" })).toBeDisabled();

    // Find the + buttons (one per player, excluding Judy)
    const plusButtons = canvas.getAllByText("+");

    // Give 2 points to Alex (first player)
    await userEvent.click(plusButtons[0]);
    await userEvent.click(plusButtons[0]);

    // Give 1 point to Ryan (second player)
    await userEvent.click(plusButtons[1]);

    // Total should now be 3 — OK enabled
    await waitFor(() => {
      expect(canvas.getByText("Points assigned: 3 / 3")).toBeInTheDocument();
    });
    expect(canvas.getByRole("button", { name: "OK" })).toBeEnabled();
  },
});

export const CannotExceedThreePoints = meta.story({
  args: { reportCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("You've been reported for cheating!")).toBeInTheDocument();
    });

    const plusButtons = canvas.getAllByText("+");

    // Assign all 3 to the first player
    await userEvent.click(plusButtons[0]);
    await userEvent.click(plusButtons[0]);
    await userEvent.click(plusButtons[0]);

    await waitFor(() => {
      expect(canvas.getByText("Points assigned: 3 / 3")).toBeInTheDocument();
    });

    // All + buttons should now be disabled (can't exceed 3)
    for (const btn of plusButtons) {
      expect(btn).toBeDisabled();
    }
  },
});
