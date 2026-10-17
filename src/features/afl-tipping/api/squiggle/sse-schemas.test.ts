import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { SSE_GAME_EVENT_NAMES, parseSseEvent } from "./sse-schemas";

// A `score` event as Squiggle's /test channel sent it on 2026-10-17.
const SCORE_EVENT = JSON.stringify({
  gameid: 127355,
  type: "behind",
  side: "hteam",
  team: 15,
  complete: 51,
  timestr: "Q4 14:59",
  score: { hgoals: 10, hbehinds: 1, hscore: 61, agoals: 11, abehinds: 3, ascore: 69 },
});

describe("parseSseEvent", () => {
  it("reads a score event into scores, time and completion", () => {
    expect(parseSseEvent("score", SCORE_EVENT)).toEqual({
      gameId: 127355,
      homeScore: 61,
      awayScore: 69,
      timeStr: "Q4 14:59",
      complete: 51,
    });
  });

  it("reads a game snapshot, keyed by id, into all five fields", () => {
    const snapshot = JSON.stringify({
      id: 55,
      hscore: 40,
      ascore: 22,
      timestr: "Q2  3:10",
      complete: 40,
      winnerteamid: null,
      hteam: "Collingwood",
      venue: "M.C.G.",
    });
    expect(parseSseEvent("game", snapshot)).toEqual({
      gameId: 55,
      homeScore: 40,
      awayScore: 22,
      timeStr: "Q2  3:10",
      complete: 40,
    });
  });

  it("carries a snapshot's winner when it has one", () => {
    const snapshot = JSON.stringify({
      id: 55,
      hscore: 90,
      ascore: 70,
      complete: 100,
      winnerteamid: 4,
    });
    expect(parseSseEvent("game", snapshot)).toMatchObject({ gameId: 55, winnerTeamId: 4 });
  });

  it("reads timestr, complete and winner events", () => {
    expect(parseSseEvent("timestr", JSON.stringify({ gameid: 7, timestr: "Q3  1:00" }))).toEqual({
      gameId: 7,
      timeStr: "Q3  1:00",
    });
    expect(parseSseEvent("complete", JSON.stringify({ gameid: 7, complete: 100 }))).toEqual({
      gameId: 7,
      complete: 100,
    });
    expect(parseSseEvent("winner", JSON.stringify({ gameid: 7, winnerteamid: 3 }))).toEqual({
      gameId: 7,
      winnerTeamId: 3,
    });
  });

  it("does not return fields an event left out", () => {
    const update = parseSseEvent("score", JSON.stringify({ gameid: 7, timestr: "Q1  5:00" }));
    expect(update).toEqual({ gameId: 7, timeStr: "Q1  5:00" });
    expect(update).not.toHaveProperty("homeScore");
  });

  it("ignores extra fields", () => {
    expect(
      parseSseEvent("complete", JSON.stringify({ gameid: 7, complete: 75, somethingNew: [1, 2] })),
    ).toEqual({ gameId: 7, complete: 75 });
  });

  it("returns null for an event name it does not know, without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseSseEvent("message", JSON.stringify("hello"))).toBeNull();
    expect(parseSseEvent("randomArray", "[]")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("lists the event names it understands", () => {
    expect(SSE_GAME_EVENT_NAMES.toSorted()).toEqual([
      "complete",
      "game",
      "score",
      "timestr",
      "winner",
    ]);
  });
});

describe("parseSseEvent with bad data", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("returns null for malformed JSON without throwing", () => {
    expect(parseSseEvent("timestr", "{not json")).toBeNull();
  });

  it("returns null for an event of the wrong shape", () => {
    expect(parseSseEvent("complete", JSON.stringify({ gameid: "x", complete: "y" }))).toBeNull();
  });

  it("warns once per event name, not once per event", () => {
    // `winner` is not used by the other tests in this file, so its warning is still unspent.
    parseSseEvent("winner", "nope");
    parseSseEvent("winner", "still nope");
    parseSseEvent("winner", JSON.stringify({ gameid: "x" }));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
