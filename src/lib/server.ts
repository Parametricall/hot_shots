import { auth } from "@clerk/tanstack-react-start/server";
import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

export async function createSupabaseServerClient() {
  const { getToken } = await auth();
  const supabaseToken = await getToken();
  return createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      global: {
        headers: supabaseToken
          ? {
              Authorization: `Bearer ${supabaseToken}`,
            }
          : {},
      },
      cookies: {
        getAll() {
          return Object.entries(getCookies()).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => {
            setCookie(cookie.name, cookie.value, cookie.options);
          });
        },
      },
    },
  );
}
