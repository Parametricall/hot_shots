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
  it("formats a date key into a readable date", () => {
    expect(formatDateHeader("2025-04-05")).toBe("Saturday 5 April 2025");
  });
});

describe("formatTime", () => {
  it("formats a time in the given zone", () => {
    // 08:30 UTC on 17 Mar 2027: 7:30pm in Melbourne (daylight saving), 6:30pm in Brisbane
    const date = new Date(Date.UTC(2027, 2, 17, 8, 30));
    expect(formatTime(date, "Australia/Melbourne")).toMatch(/^7:30\spm$/);
    expect(formatTime(date, "Australia/Brisbane")).toMatch(/^6:30\spm$/);
  });
});

describe("groupGamesByDate", () => {
  const at = (iso: string) => {
    const date = new Date(iso);
    return { date, unixTime: date.getTime() };
  };

  it("groups games by the day they start on in the zone", () => {
    const games = [
      createAflGame({ id: 1, ...at("2025-04-05T04:00:00Z") }), // Sat 2pm Brisbane
      createAflGame({ id: 2, ...at("2025-04-05T09:30:00Z") }), // Sat 7:30pm Brisbane
      createAflGame({ id: 3, ...at("2025-04-06T03:00:00Z") }), // Sun 1pm Brisbane
    ];

    const grouped = groupGamesByDate(games, "Australia/Brisbane");
    expect(Object.keys(grouped)).toEqual(["2025-04-05", "2025-04-06"]);
    expect(grouped["2025-04-05"]).toHaveLength(2);
    expect(grouped["2025-04-06"]).toHaveLength(1);
  });

  it("uses the zone's day, not UTC's", () => {
    // 22:00 UTC on Fri 4 Apr is 8am on Sat 5 Apr in Brisbane
    const games = [createAflGame({ id: 1, ...at("2025-04-04T22:00:00Z") })];
    expect(Object.keys(groupGamesByDate(games, "Australia/Brisbane"))).toEqual(["2025-04-05"]);
    expect(Object.keys(groupGamesByDate(games, "UTC"))).toEqual(["2025-04-04"]);
  });

  it("returns an empty object for empty input", () => {
    expect(groupGamesByDate([], "Australia/Brisbane")).toEqual({});
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
