import { createContext, PropsWithChildren, useContext } from "react";

export const CurrentRoundContext = createContext<undefined | number>(undefined);

export function useCurrentRound() {
  const context = useContext(CurrentRoundContext);
  if (context == undefined) throw new Error("CurrentRound provider context not available");
  return context;
}

export function CurrentRoundProvider({ children, state }: PropsWithChildren<{ state: number }>) {
  return <CurrentRoundContext value={state}>{children}</CurrentRoundContext>;
}
