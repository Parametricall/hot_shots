// Type definitions for the AFL tipping app

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
