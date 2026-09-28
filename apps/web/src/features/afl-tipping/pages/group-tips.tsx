import { GroupTipsList } from "~/features/afl-tipping/components/group-tips-list";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import {
  TippingPageShell,
  TippingPageSkeleton,
} from "~/features/afl-tipping/components/tipping-page-shell";

export function GroupTips() {
  return (
    <TippingPageShell
      skeleton={
        <TippingPageSkeleton>
          {Array.from({ length: 4 }).map((_, i) => (
            <GroupTipCardSkeleton key={i} />
          ))}
        </TippingPageSkeleton>
      }
    >
      <GroupTipsList />
    </TippingPageShell>
  );
}

export function GroupTipCardSkeleton() {
  return (
    <Card className="p-0 overflow-hidden rounded-lg">
      <CardContent className="p-0">
        <div className="px-2 py-2 bg-gray-100 flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center justify-center gap-4 py-3 px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-3 w-4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </div>
        <div className="px-3 py-2 border-t space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-md" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
