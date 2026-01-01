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
  tipTeamId: number;
};
