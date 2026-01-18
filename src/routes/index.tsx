import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";

const authStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated) {
    // This will error because you're redirecting to a path that doesn't exist yet
    // You can create a sign-in route to handle this
    // See https://clerk.com/docs/tanstack-react-start/guides/development/custom-sign-in-or-up-page
    throw redirect({
      to: "/sign-in",
    });
  }

  return { userId };
});

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    await authStateFn();

    if (location.pathname === "/") {
      throw redirect({
        to: "/afl-tipping",
      });
    }
  },
});
