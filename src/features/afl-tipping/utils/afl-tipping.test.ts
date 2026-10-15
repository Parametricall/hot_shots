import { describe, it, expect } from "vite-plus/test";
import {
  findAflTeamById,
  createUnknownAflTeam,
  formatDateHeader,
  groupGamesByDate,
  formatTime,
  aflGamesToRounds,
  getTipSnapshotMismatch,
} from "~/features/afl-tipping/utils/afl-tipping";
import { createAflTeam, createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflModelTip, AflUserTip } from "~/features/afl-tipping/types";

describe("findAflTeamById", () => {
  const teams = [createAflTeam({ id: 1, name: "Lions" }), createAflTeam({ id: 2, name: "Suns" })];

  it("returns the team with the matching id", () => {
    expect(findAflTeamById(teams, 2)?.name).toBe("Suns");
  });

  it("returns undefined when no team matches", () => {
    expect(findAflTeamById(teams, 99)).toBeUndefined();
  });
});

describe("createUnknownAflTeam", () => {
  it("creates a team with the given id and unknown defaults", () => {
    const team = createUnknownAflTeam(42);
    expect(team.id).toBe(42);
    expect(team.name).toBe("Unknown Team");
    expect(team.abbrev).toBe("UNK");
  });
});

describe("formatDateHeader", () => {
  it("formats an ISO date string into a readable date", () => {
    const result = formatDateHeader("2025-04-05");
    expect(result).toContain("2025");
    expect(result).toContain("April");
  });
});

describe("formatTime", () => {
  it("formats a date into a time string", () => {
    const date = new Date(2025, 3, 5, 19, 30);
    const result = formatTime(date);
    // Should contain 7:30 in some form (locale-dependent)
    expect(result).toMatch(/7:30/);
  });
});

describe("groupGamesByDate", () => {
  it("groups games by their date (ignoring time)", () => {
    const day1 = new Date(2025, 3, 5, 14, 0);
    const day1Later = new Date(2025, 3, 5, 19, 30);
    const day2 = new Date(2025, 3, 6, 13, 0);

    const games = [
      createAflGame({ id: 1, date: day1, unixTime: day1.getTime() }),
      createAflGame({ id: 2, date: day1Later, unixTime: day1Later.getTime() }),
      createAflGame({ id: 3, date: day2, unixTime: day2.getTime() }),
    ];

    const grouped = groupGamesByDate(games);
    const keys = Object.keys(grouped);
    expect(keys).toHaveLength(2);
    expect(grouped[keys[0]!]).toHaveLength(2);
    expect(grouped[keys[1]!]).toHaveLength(1);
  });

  it("returns an empty object for empty input", () => {
    expect(groupGamesByDate([])).toEqual({});
  });
});

describe("aflGamesToRounds", () => {
  it("groups games into rounds", () => {
    const games = [
      createAflGame({ id: 1, round: 1, roundName: "Round 1" }),
      createAflGame({ id: 2, round: 1, roundName: "Round 1" }),
      createAflGame({ id: 3, round: 2, roundName: "Round 2" }),
    ];

    const rounds = aflGamesToRounds(games);
    expect(rounds).toHaveLength(2);
    expect(rounds.find((r) => r.id === 1)?.games).toHaveLength(2);
    expect(rounds.find((r) => r.id === 2)?.games).toHaveLength(1);
  });

  it("preserves round name from the first game in each round", () => {
    const games = [createAflGame({ round: 0, roundName: "Opening Round" })];
    const rounds = aflGamesToRounds(games);
    expect(rounds[0]!.name).toBe("Opening Round");
  });
});

describe("getTipSnapshotMismatch", () => {
  const basePrediction: AflModelTip = {
    awayTeamId: 2,
    homeTeamId: 1,
    confidence: 60,
    gameId: 100,
    homeConfidence: 60,
    awayConfidence: 40,
    round: 1,
    tipTeamId: 1,
  };

  const baseTip: AflUserTip = {
    gameId: 100,
    tipTeamId: 1,
    isUnderdog: false,
  };

  it("returns 'favourite' when stored as favourite but model now tips the other team", () => {
    const tip: AflUserTip = { ...baseTip, tipTeamId: 1, isUnderdog: false };
    const prediction: AflModelTip = { ...basePrediction, tipTeamId: 2 };
    expect(getTipSnapshotMismatch(tip, prediction)).toBe("favourite");
  });

  it("returns 'underdog' when stored as underdog but model now agrees", () => {
    const tip: AflUserTip = { ...baseTip, tipTeamId: 1, isUnderdog: true };
    const prediction: AflModelTip = { ...basePrediction, tipTeamId: 1 };
    expect(getTipSnapshotMismatch(tip, prediction)).toBe("underdog");
  });

  it("returns null when stored favourite still agrees with the live prediction", () => {
    const tip: AflUserTip = { ...baseTip, tipTeamId: 1, isUnderdog: false };
    const prediction: AflModelTip = { ...basePrediction, tipTeamId: 1 };
    expect(getTipSnapshotMismatch(tip, prediction)).toBeNull();
  });

  it("returns null when stored underdog still disagrees with the live prediction", () => {
    const tip: AflUserTip = { ...baseTip, tipTeamId: 1, isUnderdog: true };
    const prediction: AflModelTip = { ...basePrediction, tipTeamId: 2 };
    expect(getTipSnapshotMismatch(tip, prediction)).toBeNull();
  });

  it("returns null for legacy tips with isUnderdog undefined", () => {
    const tip: AflUserTip = { gameId: 100, tipTeamId: 1 };
    const prediction: AflModelTip = { ...basePrediction, tipTeamId: 2 };
    expect(getTipSnapshotMismatch(tip, prediction)).toBeNull();
  });

  it("returns null when tip is undefined", () => {
    expect(getTipSnapshotMismatch(undefined, basePrediction)).toBeNull();
  });

  it("returns null when prediction is undefined", () => {
    expect(getTipSnapshotMismatch(baseTip, undefined)).toBeNull();
  });

  it("returns null when prediction.tipTeamId is null", () => {
    const prediction: AflModelTip = { ...basePrediction, tipTeamId: null };
    expect(getTipSnapshotMismatch(baseTip, prediction)).toBeNull();
  });
});
