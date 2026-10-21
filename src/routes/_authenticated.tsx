// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSessionUserId } from "~/features/auth/api/session";
import { currentUserQueryOptions } from "~/features/auth/queries";
import { IS_DEMO } from "~/lib/demo";

const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await getSessionUserId();
  return { userId };
});

export const Route = createFileRoute("/_authenticated")({
  // The Demo's services read localStorage, so its AFL pages render in the browser only.
  ssr: !IS_DEMO,
  // Auth is checked server-side (the handler reads the session cookie), so the first render
  // doesn't wait for any client JS.
  beforeLoad: async ({ location, context }) => {
    // Written out, not IS_DEMO: a constant imported from another module is not folded until
    // after chunking, so the Demo-only import below would still ship in production.
    if (import.meta.env.VITE_DEMO === "true") {
      const { DEMO_VISITOR } = await import("~/features/afl-tipping/demo/demo-visitor");
      return { userId: DEMO_VISITOR.userId };
    }
    const { userId } = await getAuthState();
    if (!userId) {
      throw redirect({ to: "/sign-in", search: { redirect_url: location.href } });
    }
    // The header shows the Profile, so load it now rather than flash an empty header.
    await context.queryClient.ensureQueryData(currentUserQueryOptions);
    return { userId };
  },
  component: Outlet,
});
