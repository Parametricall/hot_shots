// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { IS_DEMO } from "~/lib/demo";

const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await auth();
  return { userId };
});

export const Route = createFileRoute("/_authenticated")({
  // The Demo's services read localStorage, so its AFL pages render in the browser only.
  ssr: !IS_DEMO,
  // Auth is checked server-side (Clerk middleware reads the session cookie),
  // so the first render doesn't wait for Clerk's client JS to hydrate
  beforeLoad: async ({ location }) => {
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
    return { userId };
  },
  component: Outlet,
});
