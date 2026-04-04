// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { CheatingPopup } from "~/features/afl-tipping/components/cheating-popup";
import { JudyCheatingPopup } from "~/features/afl-tipping/components/judy-cheating-popup";

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
  const { user } = useUser();
  const { data } = useQuery(aflQueries.cheatingReports());
  const { data: cheatingFlag } = useQuery(aflQueries.featureFlag("cheating_report"));
  const { data: judyFlag } = useQuery(aflQueries.featureFlag("judy_report"));

  const currentUserIsJudy = user?.fullName?.startsWith("Judy") ?? false;

  const showJudyPopup = judyFlag?.enabled && data?.reported && currentUserIsJudy;
  const showRyanPopup = cheatingFlag?.enabled && data?.reported && !currentUserIsJudy;

  return (
    <>
      {showJudyPopup && <JudyCheatingPopup reportCount={data.reportCount} />}
      {showRyanPopup && <CheatingPopup reportCount={data.reportCount} />}
      <Outlet />
    </>
  );
}
