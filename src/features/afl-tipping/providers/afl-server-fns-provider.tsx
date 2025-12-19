import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { submitTip } from "~/features/afl-tipping/api/tips";

export type AflServerFnsContext = {
  submitTip: typeof submitTip;
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
    };
  }, [submitTip]);

  return <AflServerFnsContext value={context}>{children}</AflServerFnsContext>;
}
