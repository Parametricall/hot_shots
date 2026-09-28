import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { GameCard } from "./game-card";
import { renderWithClient } from "~/test/render";
import { createAflGame, createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";
import type { AflModelTip, AflUserTip } from "~/features/afl-tipping/types";

vi.mock("/dummy-footy-logo.png?url", () => ({ default: "test-logo.png" }));

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getGames: vi.fn().mockResolvedValue([]),
      getAllCurrentTeams: vi.fn().mockResolvedValue([]),
      getModelTips: vi.fn().mockResolvedValue([]),
      getTips: vi.fn().mockResolvedValue([]),
      submitTip: vi.fn().mockResolvedValue({ success: true }),
    }),
  },
}));

const futureTime = Date.now() + 1000 * 60 * 60 * 24;
const pastTime = Date.now() - 1000 * 60 * 60 * 24;

const homeTeam = createAflTeam({ id: 1, ...fakeTeams.lions });
const awayTeam = createAflTeam({ id: 2, ...fakeTeams.suns });

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

function renderGameCard({
  tip,
  prediction,
  gameOverrides,
}: {
  tip?: AflUserTip;
  prediction?: AflModelTip;
  gameOverrides?: Partial<ReturnType<typeof createAflGame>>;
}) {
  const game = createAflGame({
    id: 100,
    homeTeamId: 1,
    awayTeamId: 2,
    unixTime: futureTime,
    date: new Date(futureTime),
    ...gameOverrides,
  });

  return renderWithClient(
    <GameCard
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      tip={tip}
      prediction={prediction}
    />,
  );
}

describe("GameCard tip status notice", () => {
  it("names the tipped team and its locked status when a stored favourite now reads as underdog", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1, isUnderdog: false },
      prediction: { ...basePrediction, tipTeamId: 2 },
    });

    expect(screen.getByText("Your Lions tip counts as a Favourite")).toBeInTheDocument();
    expect(screen.getByText("Tap Lions again to update")).toBeInTheDocument();
  });

  it("names the away team when the away tip is the mismatched one", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 2, isUnderdog: true },
      prediction: { ...basePrediction, tipTeamId: 2 },
    });

    expect(screen.getByText("Your Suns tip counts as an Underdog")).toBeInTheDocument();
    expect(screen.getByText("Tap Suns again to update")).toBeInTheDocument();
  });

  it("shows the notice once, not once per responsive column", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1, isUnderdog: false },
      prediction: { ...basePrediction, tipTeamId: 2 },
    });

    expect(screen.getAllByText(/counts as/)).toHaveLength(1);
  });

  it("shows no notice when the snapshot agrees with the live prediction", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1, isUnderdog: false },
      prediction: { ...basePrediction, tipTeamId: 1 },
    });

    expect(screen.queryByText(/counts as/)).not.toBeInTheDocument();
  });

  it("shows no notice for legacy tips with isUnderdog undefined", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1 },
      prediction: { ...basePrediction, tipTeamId: 2 },
    });

    expect(screen.queryByText(/counts as/)).not.toBeInTheDocument();
  });

  it("shows no notice when there is no prediction", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1, isUnderdog: false },
      prediction: undefined,
    });

    expect(screen.queryByText(/counts as/)).not.toBeInTheDocument();
  });

  it("shows no notice when the tip is for a team not in this game", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 99, isUnderdog: false },
      prediction: { ...basePrediction, tipTeamId: 2 },
    });

    expect(screen.queryByText(/counts as/)).not.toBeInTheDocument();
  });

  it("keeps the notice but drops the re-tip hint and confidence labels after the game starts", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1, isUnderdog: false },
      prediction: { ...basePrediction, tipTeamId: 2 },
      gameOverrides: { unixTime: pastTime, date: new Date(pastTime) },
    });

    expect(screen.getByText("Your Lions tip counts as a Favourite")).toBeInTheDocument();
    expect(screen.queryByText(/Tap .* again to update/)).not.toBeInTheDocument();
    expect(screen.queryByText("Favourite")).not.toBeInTheDocument();
    expect(screen.queryByText("Underdog")).not.toBeInTheDocument();
  });

  it("renders the notice outside the team buttons so it spans the full card width", () => {
    renderGameCard({
      tip: { gameId: 100, tipTeamId: 1, isUnderdog: false },
      prediction: { ...basePrediction, tipTeamId: 2 },
    });

    const notice = screen.getByText("Your Lions tip counts as a Favourite");
    expect(notice.closest("button")).toBeNull();
  });
});
