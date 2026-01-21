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
  hScore: number | null;
  awayTeamId: number | null;
  aScore: number | null;
  winnerTeamId: number | null;
  complete: number;
};

export const AflGame = {
  isComplete: (game: AflGame): boolean => game.complete === 100,
  getActiveRound: (games: AflGame[]): number => {
    const incompleteGames = games.filter((game) => !AflGame.isComplete(game));
    if (incompleteGames.length === 0) {
      return 0;
    }

    return Math.min(...incompleteGames.map((g) => g.round));
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
};
