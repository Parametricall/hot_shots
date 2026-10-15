// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";

const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await auth();
  return { userId };
});

export const Route = createFileRoute("/_authenticated")({
  // Auth is checked server-side (Clerk middleware reads the session cookie),
  // so the first render doesn't wait for Clerk's client JS to hydrate
  beforeLoad: async ({ location }) => {
    const { userId } = await getAuthState();
    if (!userId) {
      throw redirect({ to: "/sign-in", search: { redirect_url: location.href } });
    }
    return { userId };
  },
  component: Outlet,
});
