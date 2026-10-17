import preview, { containerDecorator } from "#.storybook/preview";
import type { Decorator } from "@storybook/react-vite";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import { buildPositions } from "~/features/afl-tipping/demo/demo-positions";
import { setDemoNow } from "~/lib/clock";
import { DemoTimeControl } from "./demo-time-control";

const FIRST_GAME = new Date("2026-03-12T19:30:00+11:00").getTime();
const DAY = 24 * 60 * 60 * 1000;

// A small Season: rounds 1 to 24, three Games each.
const games = Array.from({ length: 24 }, (_, i) => i + 1).flatMap((round) =>
  [0, 1, 2].map((k) => {
    const unixTime = FIRST_GAME + (round - 1) * 7 * DAY + k * DAY;
    return createAflGame({
      id: round * 10 + k,
      round,
      roundName: `Round ${round}`,
      unixTime,
      date: new Date(unixTime),
    });
  }),
);
const positions = buildPositions(games);

/** Puts the Demo clock at a position before the story renders. */
const atPosition = (index: number): Decorator =>
  function AtPosition(Story) {
    setDemoNow(positions[index]!.at);
    return <Story />;
  };

const meta = preview.meta({
  component: DemoTimeControl,
  args: { positions },
  decorators: [containerDecorator("min-h-32")],
});

export const NearTheStart = meta.story({
  decorators: [atPosition(2)],
});

export const MidSeason = meta.story({
  decorators: [atPosition(positions.findIndex((p) => p.kind === "before-game" && p.round === 12))],
});

export const SeasonOver = meta.story({
  decorators: [atPosition(positions.length - 1)],
});
