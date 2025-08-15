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
  homeTeamId: number | null;
  awayTeamId: number | null;
};

export interface AflRound {
  id: number;
  name: string;
  games: AflGame[];
}

export interface Tip {
  gameId: string;
  selectedTeamId: string;
  confidence?: number;
}

export interface UserTips {
  roundId: string;
  tips: Tip[];
}

export interface TippingState {
  currentRound: number;
  userTips: UserTips[];
}
