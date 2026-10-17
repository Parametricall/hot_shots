import { describe, it, expect } from "vite-plus/test";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import {
  DEMO_START_ROUND,
  buildPositions,
  describePosition,
  nextGame,
  nextRound,
  positionIndexAt,
  previousGame,
  previousRound,
  roundStart,
  startingPosition,
} from "./demo-positions";

const T0 = new Date("2026-05-01T09:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function game(id: number, round: number, unixTime: number) {
  return createAflGame({
    id,
    round,
    roundName: `Round ${round}`,
    unixTime,
    date: new Date(unixTime),
  });
}

// Rounds 11-13 a week apart. Round 12 has three Games, two of them at the same time.
const games = [
  game(1, 11, T0),
  game(2, 11, T0 + 1 * DAY),
  game(3, 12, T0 + 7 * DAY),
  game(4, 12, T0 + 8 * DAY),
  game(5, 12, T0 + 8 * DAY),
  game(6, 13, T0 + 14 * DAY),
];
const positions = buildPositions(games);

describe("buildPositions", () => {
  it("has a position a minute before each distinct start time, sorted, then Season over", () => {
    expect(positions.map((p) => p.at)).toEqual([
      T0 - MINUTE,
      T0 + 1 * DAY - MINUTE,
      T0 + 7 * DAY - MINUTE,
      T0 + 8 * DAY - MINUTE,
      T0 + 14 * DAY - MINUTE,
      T0 + 14 * DAY + 6 * 60 * MINUTE,
    ]);
    expect(positions.at(-1)!.kind).toBe("season-over");
  });

  it("labels each with its Round and Game number", () => {
    expect(describePosition(positions[2]!)).toBe("Round 12 · before Game 1 of 3");
    expect(describePosition(positions[3]!)).toBe("Round 12 · before Game 2 of 3");
    expect(describePosition(positions.at(-1)!)).toBe("Season over");
  });

  it("sorts even when the Games arrive out of order", () => {
    const shuffled = buildPositions([...games].reverse());
    expect(shuffled.map((p) => p.at)).toEqual(positions.map((p) => p.at));
  });
});

describe("moving between Games", () => {
  it("steps forward and back one position", () => {
    expect(nextGame(positions, positions[0]!.at)).toBe(positions[1]);
    expect(previousGame(positions, positions[3]!.at)).toBe(positions[2]);
  });

  it("stops at both ends", () => {
    expect(previousGame(positions, positions[0]!.at)).toBe(positions[0]);
    expect(nextGame(positions, positions.at(-1)!.at)).toBe(positions.at(-1));
  });

  it("finds the position for a clock between positions", () => {
    expect(positionIndexAt(positions, positions[2]!.at + 1)).toBe(2);
    expect(positionIndexAt(positions, T0 - 10 * DAY)).toBe(0);
  });
});

describe("moving between Rounds", () => {
  it("goes to the first position of the next Round", () => {
    expect(nextRound(positions, positions[3]!.at)).toBe(positions[4]);
    expect(nextRound(positions, positions[0]!.at)).toBe(positions[2]);
  });

  it("goes to Season over from the last Round, and stays there", () => {
    expect(nextRound(positions, positions[4]!.at)).toBe(positions.at(-1));
    expect(nextRound(positions, positions.at(-1)!.at)).toBe(positions.at(-1));
  });

  it("goes back to the start of this Round, then of the previous one", () => {
    expect(previousRound(positions, positions[3]!.at)).toBe(positions[2]);
    expect(previousRound(positions, positions[2]!.at)).toBe(positions[0]);
  });

  it("stays at the first position of the first Round", () => {
    expect(previousRound(positions, positions[0]!.at)).toBe(positions[0]);
  });

  it("goes from Season over to the start of the last Round", () => {
    expect(previousRound(positions, positions.at(-1)!.at)).toBe(positions[4]);
  });

  it("finds the start of a Round, or nothing", () => {
    expect(roundStart(positions, 12)).toBe(positions[2]);
    expect(roundStart(positions, 99)).toBeUndefined();
  });
});

describe("startingPosition", () => {
  it("is just before the first Game of the start Round", () => {
    const season = buildPositions([
      game(1, DEMO_START_ROUND - 1, T0),
      game(2, DEMO_START_ROUND, T0 + DAY),
    ]);
    const start = startingPosition(season);
    expect(start).toMatchObject({ kind: "before-game", round: DEMO_START_ROUND, gameNumber: 1 });
    expect(start.at).toBe(T0 + DAY - MINUTE);
  });

  it("falls back to the first position when the Season has no such Round", () => {
    const short = buildPositions(games.filter((g) => g.round !== DEMO_START_ROUND));
    expect(startingPosition(short)).toBe(short[0]);
  });
});
