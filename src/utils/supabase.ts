import { auth } from "@clerk/tanstack-react-start/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function getSupabaseServerClient() {
  const s = createClient(supabaseUrl, supabaseKey, {
    // global: {
    //   headers: {
    //     Authorization: `Bearer ${accessToken}`,
    //   },
    // },
    async accessToken() {
      const t = (await auth()).getToken();
      return t;
    },
    // cookies: {
    //   getAll() {
    //     return Object.entries(getCookies()).map(([name, value]) => ({
    //       name,
    //       value,
    //     }));
    //   },
    //   setAll(cookies) {
    //     cookies.forEach((cookie) => {
    //       setCookie(cookie.name, cookie.value, cookie.options);
    //     });
    //   },
    // },
  });
  return s;
}
