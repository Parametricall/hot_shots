import preview, { centeredYDecorator, containerDecorator } from "#.storybook/preview";
import {
  RoundNavigation,
  type RoundNavigationProps,
} from "~/features/afl-tipping/components/round-navigation";
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
  statuses,
}: {
  initialRound?: number;
  roundsList?: AflRound[];
  statuses?: RoundNavigationProps["statuses"];
}) {
  const [currentRound, setCurrentRound] = useState<number | undefined>(initialRound);
  return (
    <RoundNavigation
      rounds={roundsList}
      currentRound={currentRound ?? 0}
      onRoundChange={setCurrentRound}
      statuses={statuses}
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
    await userEvent.click(nextButtons[0]!);

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
    await userEvent.click(prevButtons[0]!);

    // Should now show Round 2
    const updatedLabels = canvas.getAllByText("Round 2");
    expect(updatedLabels.length).toBeGreaterThan(0);
  },
});

const STATUSES: RoundNavigationProps["statuses"] = rounds.map((_, i) =>
  i < 5 ? "closed" : i === 5 ? "untipped" : i < 9 ? "tipped" : undefined,
);

/** On a phone: the strip of chips, each with a dot. Resize the canvas under 768px to see it. */
export const PhoneChipStrip = meta.story({
  globals: { viewport: { value: "mobile1" } },
  render: () => <RoundNavigationWrapper initialRound={5} statuses={STATUSES} />,
});

/** The Finals chips are orange, and named by their first word. */
export const PhoneChipStripInFinals = meta.story({
  globals: { viewport: { value: "mobile1" } },
  render: () => {
    const finals = [...makeRounds(26), { id: 26, name: "Qualifying Final", games: [] }];
    return <RoundNavigationWrapper initialRound={26} roundsList={finals} />;
  },
});
