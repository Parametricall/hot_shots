import { useSupabaseClient } from "~/lib/supabaseClient";
import { createContext, useContext, PropsWithChildren, useMemo } from "react";

const createPersistence = (
  supabaseClient: ReturnType<typeof useSupabaseClient>,
) => {
  return {
    selectTips: async (gameId: number, teamId: number) => {
      return supabaseClient.from("afl_tipping");
    },
  };
};

export const AflPersistenceProviderContext = createContext<null | ReturnType<
  typeof createPersistence
>>(null);

export function useAflPersistence() {
  const context = useContext(AflPersistenceProviderContext);
  if (!context)
    throw new Error("AFL persitance provider context not available");
  return context;
}

export function AflPersistenceProvider({ children }: PropsWithChildren) {
  const supabaseClient = useSupabaseClient();

  const value = useMemo(() => {
    return createPersistence(supabaseClient);
  }, [supabaseClient]);

  return (
    <AflPersistenceProviderContext value={value}>
      {children}
    </AflPersistenceProviderContext>
  );
}
