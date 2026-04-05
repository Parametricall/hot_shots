// src/routes/_authenticated.tsx
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@clerk/tanstack-react-start";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { CheatingPopup } from "~/features/afl-tipping/components/cheating-popup";
import { AppLoadingScreen } from "~/components/AppLoadingScreen";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <AppLoadingScreen />;
  if (!isSignedIn) return <Navigate to="/sign-in" />;

  return <AuthenticatedContent />;
}

function AuthenticatedContent() {
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
