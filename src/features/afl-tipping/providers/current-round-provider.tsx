import { createContext, PropsWithChildren, useContext, useState } from "react";

export const CurrentRoundContext = createContext<null | ReturnType<number>>(
  null,
);

export function useCurrentRound() {
  const context = useContext(CurrentRoundContext);
  if (!context) throw new Error("CurrentRound provider context not available");
  return context;
}

export function CurrentRoundProvider({ children }: PropsWithChildren) {
  const roundState = useState<number>();

  return (
    <CurrentRoundContext value={roundState}>{children}</CurrentRoundContext>
  );
}
