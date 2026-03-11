export type Venue = {
  name: string;
  city?: string;
  state?: string;
};

export type AflTeam = {
  abbrev: string;
  logo: string;
  name: string;
  id: number;
  debut: number;
};

export type AflStanding = {
  id: number;
  name: string;
  rank: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number; // 4 points for win, 2 points for draw, 0 points for loss
  goalsFor: number;
  goalsAgainst: number;
  behindsFor: number;
  behindsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  percentage: number;
};

export type AflGame = {
  id: number;
  round: number;
  roundName: string;
  venue: Venue;
  unixTime: number;
  date: Date;
  timeStr: string;
  homeTeamId: number | null;
  homeScore: number | null;
  awayTeamId: number | null;
  awayScore: number | null;
  winnerTeamId: number | null;
  complete: number;
};

export const AflGame = {
  hasStarted: (game: AflGame) => Date.now() >= game.unixTime,
  isComplete: (game: AflGame): boolean => game.complete === 100,
  getActiveRound: (games: AflGame[]): number => {
    const incompleteGames = games.filter((game) => !AflGame.isComplete(game));
    if (incompleteGames.length === 0) {
      return 0;
    }

    return Math.min(...incompleteGames.map((g) => g.round));
  },
  getFirstGameOfRound(games: AflGame[]): AflGame | undefined {
    if (games.length === 0) return undefined;
    return games.reduce((earliest, game) => (game.unixTime < earliest.unixTime ? game : earliest));
  },
  groupByRound(games: AflGame[]): Record<number, AflGame[]> {
    return games.reduce(
      (acc, game) => {
        if (!acc[game.round]) {
          acc[game.round] = [];
        }
        acc[game.round].push(game);
        return acc;
      },
      {} as Record<number, AflGame[]>,
    );
  },
};

export interface AflRound {
  id: number;
  name: string;
  games: AflGame[];
}

export type AflModelTip = {
  awayTeamId: number | null;
  homeTeamId: number | null;
  confidence: number | null;
  gameId: number | null;
  homeConfidence: number | null;
  awayConfidence: number | null;
  round: number;
  tipTeamId: number | null;
};

export type AflUserTip = {
  gameId: number;
  tipTeamId: number;
  margin?: number;
};

export type AflGroupTipEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gameId: number;
  hasTipped: boolean;
  tipTeamId: number | null; // null if game hasn't started (server-enforced)
  margin?: number | null; // only present for the first game of the round, after it starts
  hasMargin?: boolean; // true if user has set a margin (pre-game, without revealing value)
};

export type AflLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  correctTips: number;
  totalMarginDiff: number;
  score: number;
};
