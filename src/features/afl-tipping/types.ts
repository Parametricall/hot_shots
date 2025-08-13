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
