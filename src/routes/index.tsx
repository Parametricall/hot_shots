import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/") {
      throw redirect({
        to: "/afl-tipping",
      });
    }
  },
});
