// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { CheatingPopup } from "~/features/afl-tipping/components/cheating-popup";

const authStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) {
    throw redirect({ to: "/sign-in" });
  }
  return { userId };
});

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    await authStateFn();
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data } = useQuery(aflQueries.cheatingReports());
  const { data: cheatingFlag } = useQuery(aflQueries.featureFlag("cheating_report"));

  const showPopup = cheatingFlag?.enabled && data?.reported;

  return (
    <>
      {showPopup && <CheatingPopup reportCount={data.reportCount} />}
      <Outlet />
    </>
  );
}
