import { getCookies, setCookie } from "@tanstack/react-start/server";
import { createServerClient } from "@supabase/ssr";
import { auth } from "@clerk/tanstack-react-start/server";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function getSupabaseServerClient() {
  console.log("Creating Supabase server client");
  const s = createServerClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      console.log("Fetching access token for Supabase server client");
      const t = (await auth()).getToken();
      console.log("Access token fetched:", t);
      return t;
    },
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        cookies.forEach((cookie) => {
          setCookie(cookie.name, cookie.value, cookie.options);
        });
      },
    },
  });
  console.log("Supabase server client created");
  return s;
}
