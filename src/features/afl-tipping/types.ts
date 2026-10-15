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
  isFinals: boolean;
  isGrandFinal: boolean;
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
  isUnderdog?: boolean;
  isAutoTip?: boolean; // the Home team, given because the Tipster missed Lockout
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
  isAutoTip?: boolean; // the Home team, given because the Tipster missed Lockout
};

export type AflLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  correctTips: number;
  totalMarginDiff: number;
  score: number;
};

export type AflPlayerRoundStats = {
  round: number;
  isFinals: boolean;
  correctTips: number;
  gamesTipped: number; // completed games the user tipped
  gamesCompleted: number; // completed games in the round
  totalGames: number;
  marginDiff: number | null; // diff on the round's margin game; null until it completes or if the user didn't tip it
  underdogCount: number;
  meetsMinimum: boolean;
};

export type AflPlayerSeasonStats = {
  correctTips: number;
  gamesTipped: number;
  gamesCompleted: number;
  accuracy: number | null; // 0-100, correctTips / gamesTipped; null when no completed tipped games
  totalMarginDiff: number;
  currentStreak: number; // consecutive correct tips ending at the most recent completed tipped game
  longestStreak: number;
  totalUnderdogs: number;
};

export type AflPlayerStatsEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  season: AflPlayerSeasonStats;
  rounds: AflPlayerRoundStats[];
};
