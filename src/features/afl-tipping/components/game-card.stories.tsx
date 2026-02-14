import preview, { centeredYDecorator, containerDecorator } from "#.storybook/preview";
import { GameCard } from "~/features/afl-tipping/components/game-card";
import { createAflGame, createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";
import { AflGame } from "~/features/afl-tipping/types";

const homeTeam = createAflTeam({ id: 1, ...fakeTeams.lions });
const awayTeam = createAflTeam({ id: 2, ...fakeTeams.suns });

const currentGame = createAflGame({
  id: 100,
  round: 10,
  homeTeamId: 1,
  awayTeamId: 2,
});

// Helper to create a completed game in a prior round
function completedGame(overrides: Partial<AflGame> & { id: number; round: number }) {
  const pastTime = Date.now() - 1000 * 60 * 60 * 24 * 7;
  return createAflGame({
    complete: 100,
    unixTime: pastTime,
    date: new Date(pastTime),
    homeScore: 80,
    awayScore: 70,
    ...overrides,
  });
}

// Build a history where home team (1) won 4 of last 5, away team (2) won 2 of last 5
// Also includes one H2H game won by the home team
const gamesWithHistory: AflGame[] = [
  // Home team games (team 1): W, W, L, W, W (most recent first)
  completedGame({ id: 1, round: 9, homeTeamId: 1, awayTeamId: 3, winnerTeamId: 1 }),
  completedGame({ id: 2, round: 8, homeTeamId: 4, awayTeamId: 1, winnerTeamId: 1 }),
  completedGame({ id: 3, round: 7, homeTeamId: 1, awayTeamId: 5, winnerTeamId: 5 }),
  completedGame({ id: 4, round: 6, homeTeamId: 6, awayTeamId: 1, winnerTeamId: 1 }),
  completedGame({ id: 5, round: 5, homeTeamId: 1, awayTeamId: 7, winnerTeamId: 1 }),
  // Away team games (team 2): L, W, L, W, L
  completedGame({ id: 6, round: 9, homeTeamId: 2, awayTeamId: 3, winnerTeamId: 3 }),
  completedGame({ id: 7, round: 8, homeTeamId: 2, awayTeamId: 4, winnerTeamId: 2 }),
  completedGame({ id: 8, round: 7, homeTeamId: 5, awayTeamId: 2, winnerTeamId: 5 }),
  completedGame({ id: 9, round: 6, homeTeamId: 2, awayTeamId: 6, winnerTeamId: 2 }),
  completedGame({ id: 10, round: 5, homeTeamId: 7, awayTeamId: 2, winnerTeamId: 7 }),
  // H2H game: home team won
  completedGame({ id: 11, round: 3, homeTeamId: 1, awayTeamId: 2, winnerTeamId: 1 }),
  // The current game itself
  currentGame,
];

const gamesNoHistory: AflGame[] = [
  createAflGame({ id: 100, round: 1, homeTeamId: 1, awayTeamId: 2 }),
];

const mockSquiggleService = (games: AflGame[]) => ({
  getGames: () => Promise.resolve(games),
});

const meta = preview.meta({
  component: GameCard,
  args: {
    game: currentGame,
    homeTeam,
    awayTeam,
    onTipSelect: () => {},
  },
  parameters: { layout: "padded" },
  decorators: [containerDecorator("max-w-xl"), centeredYDecorator],
});

export const WithStats = meta.story({
  tags: ["demo"],
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesWithHistory),
    },
  },
});

export const NoHistory = meta.story({
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesNoHistory),
    },
  },
});

// All wins for home, all losses for away
const allWinsLosses: AflGame[] = [
  ...Array.from({ length: 5 }, (_, i) =>
    completedGame({
      id: i + 1,
      round: i + 1,
      homeTeamId: 1,
      awayTeamId: i + 3,
      winnerTeamId: 1,
    }),
  ),
  ...Array.from({ length: 5 }, (_, i) =>
    completedGame({
      id: i + 6,
      round: i + 1,
      homeTeamId: 2,
      awayTeamId: i + 3,
      winnerTeamId: i + 3,
    }),
  ),
  currentGame,
];

export const AllWinsVsAllLosses = meta.story({
  parameters: {
    services: {
      squiggleService: mockSquiggleService(allWinsLosses),
    },
  },
});

// Multiple H2H games with away team leading
const multipleH2H: AflGame[] = [
  completedGame({ id: 1, round: 2, homeTeamId: 1, awayTeamId: 2, winnerTeamId: 2 }),
  completedGame({ id: 2, round: 5, homeTeamId: 2, awayTeamId: 1, winnerTeamId: 2 }),
  completedGame({ id: 3, round: 8, homeTeamId: 1, awayTeamId: 2, winnerTeamId: 1 }),
  currentGame,
];

export const H2HAwayLeads = meta.story({
  parameters: {
    services: {
      squiggleService: mockSquiggleService(multipleH2H),
    },
  },
});

// Mixed results including draws and byes
const gamesWithDrawsAndByes: AflGame[] = [
  // Home team (1): round 9 win, round 8 draw, round 7 bye, round 6 loss, round 5 win
  completedGame({ id: 1, round: 9, homeTeamId: 1, awayTeamId: 3, winnerTeamId: 1 }),
  completedGame({
    id: 2,
    round: 8,
    homeTeamId: 1,
    awayTeamId: 4,
    winnerTeamId: null,
    homeScore: 80,
    awayScore: 80,
  }),
  // No game in round 7 for team 1 = bye
  completedGame({ id: 3, round: 6, homeTeamId: 5, awayTeamId: 1, winnerTeamId: 5 }),
  completedGame({ id: 4, round: 5, homeTeamId: 1, awayTeamId: 6, winnerTeamId: 1 }),
  // Away team (2): round 9 bye, round 8 win, round 7 draw, round 6 win, round 5 loss
  completedGame({ id: 5, round: 8, homeTeamId: 2, awayTeamId: 3, winnerTeamId: 2 }),
  completedGame({
    id: 6,
    round: 7,
    homeTeamId: 4,
    awayTeamId: 2,
    winnerTeamId: null,
    homeScore: 70,
    awayScore: 70,
  }),
  completedGame({ id: 7, round: 6, homeTeamId: 2, awayTeamId: 5, winnerTeamId: 2 }),
  completedGame({ id: 8, round: 5, homeTeamId: 6, awayTeamId: 2, winnerTeamId: 6 }),
  currentGame,
];

export const DrawsAndByes = meta.story({
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesWithDrawsAndByes),
    },
  },
});

// Prediction stories showing Favourite/Underdog labels
export const HomeFavourite = meta.story({
  args: {
    prediction: {
      homeTeamId: 1,
      awayTeamId: 2,
      gameId: 100,
      round: 10,
      tipTeamId: 1,
      confidence: 72,
      homeConfidence: 72,
      awayConfidence: 28,
    },
  },
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesWithHistory),
    },
  },
});

export const AwayFavourite = meta.story({
  args: {
    prediction: {
      homeTeamId: 1,
      awayTeamId: 2,
      gameId: 100,
      round: 10,
      tipTeamId: 2,
      confidence: 65,
      homeConfidence: 35,
      awayConfidence: 65,
    },
  },
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesWithHistory),
    },
  },
});

export const EvenMatchup = meta.story({
  args: {
    prediction: {
      homeTeamId: 1,
      awayTeamId: 2,
      gameId: 100,
      round: 10,
      tipTeamId: 1,
      confidence: 50,
      homeConfidence: 50,
      awayConfidence: 50,
    },
  },
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesWithHistory),
    },
  },
});

export const PredictionLoading = meta.story({
  args: {
    predictionLoading: true,
  },
  parameters: {
    services: {
      squiggleService: mockSquiggleService(gamesWithHistory),
    },
  },
});
