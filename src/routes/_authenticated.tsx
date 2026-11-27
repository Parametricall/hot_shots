// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSessionUserId } from "~/features/auth/api/session";
import { currentUserQueryKey, currentUserQueryOptions } from "~/features/auth/queries";
import { IS_DEMO } from "~/lib/demo";

const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await getSessionUserId();
  return { userId };
});

/** How long a navigation in the browser trusts the last session check before asking again. */
const SESSION_RECHECK_MS = 60 * 1000;

let lastSessionCheckAt = Number.NEGATIVE_INFINITY;

export const Route = createFileRoute("/_authenticated")({
  // The Demo's services read localStorage, so its AFL pages render in the browser only.
  ssr: !IS_DEMO,
  /**
   * The guard runs on every navigation, so it must not wait on the server each time. A page load
   * is checked on the server (the handler reads the session cookie), so the first render waits
   * for no client JS. In the browser, a Profile already in the cache means the session was
   * checked when the site loaded: the navigation goes ahead at once, and the session is checked
   * again in the background, at most once a minute, sending a Tipster whose session has ended to
   * sign in. The guard is only for the Tipster's sake: every server function checks the session
   * itself before it reads a row (`ensureTipster`), so a page shown on a stale check gets no data.
   */
  beforeLoad: async ({ location, context: { queryClient }, navigate, preload }) => {
    // Written out, not IS_DEMO: a constant imported from another module is not folded until
    // after chunking, so the Demo-only import below would still ship in production.
    if (import.meta.env.VITE_DEMO === "true") {
      const { DEMO_VISITOR } = await import("~/features/afl-tipping/demo/demo-visitor");
      return { userId: DEMO_VISITOR.userId };
    }

    const cachedProfile =
      typeof window === "undefined"
        ? undefined
        : queryClient.getQueryData(currentUserQueryOptions.queryKey);
    if (cachedProfile) {
      if (!preload && Date.now() - lastSessionCheckAt > SESSION_RECHECK_MS) {
        lastSessionCheckAt = Date.now();
        void getAuthState()
          .then(({ userId }) => {
            if (userId) return;
            queryClient.removeQueries({ queryKey: currentUserQueryKey });
            return navigate({ to: "/sign-in", search: { redirect_url: location.href } });
          })
          .catch(() => {
            // Offline or the server is down: the page's own queries show the error.
          });
      }
      return { userId: cachedProfile.id };
    }

    const { userId } = await getAuthState();
    lastSessionCheckAt = Date.now();
    if (!userId) {
      throw redirect({ to: "/sign-in", search: { redirect_url: location.href } });
    }
    // The header shows the Profile, so load it now rather than flash an empty header.
    await queryClient.ensureQueryData(currentUserQueryOptions);
    return { userId };
  },
  component: Outlet,
});
