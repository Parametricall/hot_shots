import { createClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/tanstack-react-start";
import { useMemo } from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useSupabaseClient() {
  const { session } = useSession();
  return useMemo(
    () =>
      session
        ? createClient(supabaseUrl, supabasePublishableKey, {
            accessToken: async () => {
              return session.getToken() ?? null;
            },
          })
        : undefined,
    [session],
  );
}
