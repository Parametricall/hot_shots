// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";

const authStateFn = createServerFn({ method: "GET" }).handler(async () => {
  console.log("Checking authentication state...");
  const { isAuthenticated, userId } = await auth();
  console.log("Authentication state:", { isAuthenticated, userId });
  if (!isAuthenticated) {
    throw redirect({ to: "/sign-in" });
  }
  return { userId };
});

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    await authStateFn();
  },
  component: () => <Outlet />,
});
