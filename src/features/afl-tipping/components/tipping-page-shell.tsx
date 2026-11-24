import {
  type CSSProperties,
  PropsWithChildren,
  ReactNode,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { useLiveScores } from "~/features/afl-tipping/hooks/use-live-scores";
import { aflGamesToRounds } from "~/features/afl-tipping/utils/afl-tipping";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { RoundStatusLine } from "~/features/afl-tipping/components/round-status-line";
import { useNow } from "~/features/afl-tipping/hooks/use-now";
import { useSeasonTips } from "~/features/afl-tipping/hooks/use-season-tips";
import { roundDotStatus } from "~/features/afl-tipping/utils/round-status";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { QueryErrorBoundary } from "~/components/QueryErrorResetBoundary";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { useIsMobile } from "~/lib/use-is-mobile";

/**
 * What every Round page (My Tips, Round) sits in: the Round chips and a status line, which stay
 * put under the header while the Games scroll beneath them, then the Games. On a phone the page
 * scrolls as a whole; the chrome is `sticky`, and publishes how far down it reaches as
 * `--sticky-top`, so the date headers in the lists can stick just below it.
 */
export function TippingPageShell({
  skeleton,
  showUnderdogs,
  children,
}: {
  skeleton: ReactNode;
  /** Show the Underdog quota chip on the status line (My Tips only). */
  showUnderdogs?: boolean;
  children: ReactNode;
}) {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={skeleton}>
        <TippingPageContent showUnderdogs={showUnderdogs}>{children}</TippingPageContent>
      </Suspense>
    </QueryErrorBoundary>
  );
}

function TippingPageContent({
  showUnderdogs,
  children,
}: PropsWithChildren<{ showUnderdogs?: boolean }>) {
  const search = useSearch({ strict: false }) as { round?: number };
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const season = useSeason();

  const { data: games } = useSuspenseQuery(aflQueries.allGames(season));
  useLiveScores(season, games);

  const rounds = useMemo(() => aflGamesToRounds(games), [games]);
  const activeRound = useMemo(() => AflGame.getActiveRound(games), [games]);

  const currentRound = search.round ?? activeRound;

  const { data: tips } = useSeasonTips(season, games);
  const at = useNow();
  const statuses = useMemo(
    () => (tips ? rounds.map((round) => roundDotStatus(round.games, tips, at)) : undefined),
    [rounds, tips, at],
  );

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

  const roundNav = (
    <RoundNavigation
      rounds={rounds}
      currentRound={currentRound}
      activeRound={activeRound}
      onRoundChange={handleRoundChange}
      statuses={statuses}
    />
  );
  const statusLine = <RoundStatusLine showUnderdogs={showUnderdogs} />;

  return (
    <CurrentRoundProvider state={currentRound}>
      {isMobile ? (
        <MobileTippingPageBody chrome={roundNav} statusLine={statusLine}>
          {children}
        </MobileTippingPageBody>
      ) : (
        <DesktopTippingPageBody chrome={roundNav} statusLine={statusLine}>
          {children}
        </DesktopTippingPageBody>
      )}
    </CurrentRoundProvider>
  );
}

function MobileTippingPageBody({
  chrome,
  statusLine,
  children,
}: PropsWithChildren<{ chrome: ReactNode; statusLine: ReactNode }>) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);

  // `--sticky-top` is where sticky things in the list stick: under the header and this chrome.
  // The chrome's height changes (the status line appears, the Underdog chip wraps), so measure it.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const chromeEl = chromeRef.current;
    if (!body || !chromeEl) return;
    const update = () =>
      body.style.setProperty(
        "--sticky-top",
        `calc(var(--header-h, 0px) + ${chromeEl.offsetHeight}px)`,
      );
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(chromeEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={bodyRef} className="flex-1" data-app-ready>
      <div
        ref={chromeRef}
        className="sticky top-[var(--header-h,0px)] z-30 -mx-2 space-y-1 bg-background/95 px-2 pb-2 pt-1 backdrop-blur"
      >
        {chrome}
        {statusLine}
      </div>
      {children}
    </div>
  );
}

function DesktopTippingPageBody({
  chrome,
  statusLine,
  children,
}: PropsWithChildren<{ chrome: ReactNode; statusLine: ReactNode }>) {
  return (
    <div
      className="space-y-4 sm:space-y-6"
      style={{ "--sticky-top": "var(--header-h, 0px)" } as CSSProperties}
      data-app-ready
    >
      <div className="space-y-2">
        {chrome}
        {statusLine}
      </div>
      {children}
    </div>
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
        <div className="flex gap-1.5 overflow-hidden md:hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-14 shrink-0 rounded-full" />
          ))}
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
