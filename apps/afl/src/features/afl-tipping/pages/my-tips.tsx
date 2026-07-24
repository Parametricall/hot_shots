import { GamesList } from "~/features/afl-tipping/components/games-list";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import {
  TippingPageShell,
  TippingPageSkeleton,
} from "~/features/afl-tipping/components/tipping-page-shell";
import { UnderdogWarning } from "~/features/afl-tipping/components/underdog-warning";

export function MyTips() {
  return (
    <TippingPageShell
      extraChrome={<UnderdogWarning />}
      skeleton={
        <TippingPageSkeleton>
          {Array.from({ length: 4 }).map((_, i) => (
            <GameCardSkeleton key={i} showMargin={i === 0} />
          ))}
        </TippingPageSkeleton>
      }
    >
      <GamesList />
    </TippingPageShell>
  );
}

export function GameCardSkeleton({ showMargin = false }: { showMargin?: boolean }) {
  return (
    <Card className="p-0 overflow-hidden rounded-lg">
      <CardContent className="p-0">
        {/* Header bar */}
        <div className="px-2 py-2 bg-gray-100 flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
        {/* Team matchup */}
        <div className="flex min-h-20 sm:min-h-22.5">
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-2">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="hidden sm:block h-3 w-16" />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 p-2">
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-2">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="hidden sm:block h-3 w-16" />
          </div>
        </div>
        {/* Margin input */}
        {showMargin && (
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border-t">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-6" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
