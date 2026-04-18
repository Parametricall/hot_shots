import { PropsWithChildren, ReactNode, Suspense, useCallback, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { aflGamesToRounds } from "~/features/afl-tipping/utils/afl-tipping";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { QueryErrorBoundary } from "~/components/QueryErrorResetBoundary";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";

export function TippingPageShell({
  skeleton,
  children,
}: {
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={skeleton}>
        <TippingPageContent>{children}</TippingPageContent>
      </Suspense>
    </QueryErrorBoundary>
  );
}

function TippingPageContent({ children }: PropsWithChildren) {
  const search = useSearch({ strict: false }) as { round?: number };
  const navigate = useNavigate();

  const { data: games } = useSuspenseQuery(aflQueries.allGames());

  const rounds = useMemo(() => aflGamesToRounds(games), [games]);
  const activeRound = useMemo(() => AflGame.getActiveRound(games), [games]);

  const currentRound = search.round ?? activeRound;

  const handleRoundChange = useCallback(
    (round: number | undefined) => {
      if (round == undefined) return;
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, round }),
        replace: true,
      });
    },
    [navigate],
  );

  if (currentRound == undefined) return "No round";

  return (
    <CurrentRoundProvider state={currentRound}>
      <div className="space-y-4 sm:space-y-6" data-app-ready>
        <RoundNavigation
          rounds={rounds}
          currentRound={currentRound}
          activeRound={activeRound}
          onRoundChange={handleRoundChange}
        />
        {children}
      </div>
    </CurrentRoundProvider>
  );
}

export function TippingPageSkeleton({ children }: PropsWithChildren) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <RoundNavigationSkeleton />
      <div className="space-y-2 sm:space-y-3">
        <Skeleton className="h-6 w-40 border-b pb-1 sm:pb-2" />
        <div className="space-y-2 sm:space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function RoundNavigationSkeleton() {
  return (
    <Card className="mb-2 sm:mb-4 py-2">
      <CardContent className="p-3 sm:p-4">
        {/* Mobile */}
        <div className="flex items-center justify-between md:hidden">
          <Skeleton className="h-9 w-17.5" />
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 w-17.5" />
        </div>
        {/* Desktop */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {Array.from({ length: 28 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
