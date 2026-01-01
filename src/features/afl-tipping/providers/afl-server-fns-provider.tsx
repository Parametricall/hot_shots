import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { getTips, submitTip } from "~/features/afl-tipping/api/tips";

export type AflServerFnsContext = {
  submitTip: typeof submitTip;
  getTips: typeof getTips;
};

export const AflServerFnsContext = createContext<null | AflServerFnsContext>(
  null,
);

export function useAflServerFns() {
  const context = useContext(AflServerFnsContext);
  if (!context) throw new Error("AflServerFns provider context not available");
  return context;
}

export function AflServerFnsProvider({ children }: PropsWithChildren) {
  const context: AflServerFnsContext = useMemo(() => {
    return {
      submitTip,
      getTips,
    };
  }, [submitTip, getTips]);

  return <AflServerFnsContext value={context}>{children}</AflServerFnsContext>;
}
