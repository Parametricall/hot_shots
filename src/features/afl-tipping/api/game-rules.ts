// Abstraction for AFL tipping game rules

export interface CanSubmitTipParams {
  gameStart: Date;
  now?: Date;
}

export const gameRules = {
  canSubmitTip({ gameStart, now = new Date() }: CanSubmitTipParams): boolean {
    return now < gameStart;
  },
  // Future rules can be added here
};
