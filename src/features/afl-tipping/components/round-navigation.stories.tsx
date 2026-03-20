import preview, { containerDecorator, centeredYDecorator, withRouter } from "#.storybook/preview";
import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { useState } from "react";
import type { AflRound } from "~/features/afl-tipping/types";
import { expect, userEvent, within } from "storybook/test";

function makeRounds(count: number): AflRound[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: i === 0 ? "Opening Round" : `Round ${i}`,
    games: [],
  }));
}

const rounds = makeRounds(25);

function RoundNavigationWrapper({
  initialRound = 5,
  roundsList = rounds,
}: {
  initialRound?: number;
  roundsList?: AflRound[];
}) {
  const [currentRound, setCurrentRound] = useState<number | undefined>(initialRound);
  return (
    <RoundNavigation
      rounds={roundsList}
      currentRound={currentRound ?? 0}
      onRoundChange={setCurrentRound}
    />
  );
}

const meta = preview.meta({
  component: RoundNavigation,
  decorators: [containerDecorator("max-w-2xl"), centeredYDecorator],
});

export const Default = meta.story({
  render: () => <RoundNavigationWrapper />,
});

export const FirstRound = meta.story({
  render: () => <RoundNavigationWrapper initialRound={0} />,
});

export const LastRound = meta.story({
  render: () => <RoundNavigationWrapper initialRound={24} />,
});

export const NavigateForward = meta.story({
  render: () => <RoundNavigationWrapper initialRound={3} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should start at Round 3
    const roundLabels = canvas.getAllByText("Round 3");
    expect(roundLabels.length).toBeGreaterThan(0);

    // Click Next
    const nextButtons = canvas.getAllByRole("button", { name: /next/i });
    await userEvent.click(nextButtons[0]);

    // Should now show Round 4
    const updatedLabels = canvas.getAllByText("Round 4");
    expect(updatedLabels.length).toBeGreaterThan(0);
  },
});

export const NavigateBackward = meta.story({
  render: () => <RoundNavigationWrapper initialRound={3} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click Prev
    const prevButtons = canvas.getAllByRole("button", { name: /prev/i });
    await userEvent.click(prevButtons[0]);

    // Should now show Round 2
    const updatedLabels = canvas.getAllByText("Round 2");
    expect(updatedLabels.length).toBeGreaterThan(0);
  },
});
