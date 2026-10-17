import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import {
  DEMO_START_ROUND,
  buildPositions,
  describePosition,
  nextGame,
  nextRound,
  positionIndexAt,
  previousGame,
  previousRound,
  roundStart,
  roundsOf,
  startingPosition,
  type DemoPosition,
} from "~/features/afl-tipping/demo/demo-positions";
import { requireSnapshot } from "~/features/afl-tipping/demo/squiggle.service.demo";
import { loadSnapshot } from "~/features/afl-tipping/demo/snapshot";
import { useDemoClock } from "~/features/afl-tipping/demo/use-demo-clock";
import { visitorStore } from "~/features/afl-tipping/demo/visitor-store";
import { setDemoNow } from "~/lib/clock";

const GAME_TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Melbourne",
});

const MINUTE_MS = 60 * 1000;

type DemoTimeControlProps = {
  /** Where the clock can stop. Omit it to build them from the snapshot. */
  positions?: DemoPosition[];
};

/**
 * The Time control: a bar fixed to the bottom of every AFL Tipping page in the
 * Demo (docs/adr/0004). It moves the Demo clock Game by Game or Round by Round,
 * and every move tells every AFL query to refetch.
 */
export function DemoTimeControl({ positions: givenPositions }: DemoTimeControlProps) {
  const queryClient = useQueryClient();
  const clock = useDemoClock();
  const { data: loadedPositions } = useQuery({
    queryKey: ["demo", "positions"],
    queryFn: async () => buildPositions((await requireSnapshot(loadSnapshot)).games),
    enabled: givenPositions === undefined,
    staleTime: Infinity,
  });
  const positions = givenPositions ?? loadedPositions;

  if (!positions || clock === undefined) return null;

  const index = positionIndexAt(positions, clock);
  const current = positions[index]!;
  const rounds = roundsOf(positions);

  function moveTo(position: DemoPosition) {
    setDemoNow(position.at);
    visitorStore.savePosition(position.at);
    void queryClient.invalidateQueries({ queryKey: aflQueries.aflKey() });
  }

  function reset() {
    visitorStore.clearAll();
    moveTo(startingPosition(positions!));
  }

  const atStart = index === 0;
  const atEnd = current.kind === "season-over";
  const atFirstRound = previousRound(positions, current.at).at === current.at;
  const label = describePosition(current);
  const gameTime =
    current.kind === "before-game"
      ? GAME_TIME_FORMAT.format(new Date(current.at + MINUTE_MS))
      : undefined;

  return (
    <div
      data-slot="demo-time-control"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
    >
      <div className="container mx-auto flex flex-col gap-1.5 px-2 py-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" role="status" aria-live="polite">
            {label}
            {gameTime && <span className="text-muted-foreground"> · {gameTime}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Demo: the other Tipsters are made up. Your Tips stay in this browser.
          </p>
        </div>

        <div className="flex items-center justify-between gap-1 md:justify-end">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous round"
            disabled={atFirstRound}
            onClick={() => moveTo(previousRound(positions, current.at))}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous game"
            disabled={atStart}
            onClick={() => moveTo(previousGame(positions, current.at))}
          >
            <ChevronLeft />
          </Button>
          <select
            aria-label="Jump to round"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm md:flex-none"
            value={current.kind === "before-game" ? current.round : "over"}
            onChange={(event) => {
              const target =
                event.target.value === "over"
                  ? positions[positions.length - 1]
                  : roundStart(positions, Number(event.target.value));
              if (target) moveTo(target);
            }}
          >
            {rounds.map((round) => (
              <option key={round.round} value={round.round}>
                {round.roundName}
              </option>
            ))}
            <option value="over">Season over</option>
          </select>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next game"
            disabled={atEnd}
            onClick={() => moveTo(nextGame(positions, current.at))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next round"
            disabled={atEnd}
            onClick={() => moveTo(nextRound(positions, current.at))}
          >
            <ChevronsRight />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0" aria-label="Reset demo">
                <RotateCcw />
                <span className="hidden sm:inline">Reset demo</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears the Tips you made and takes you back to the start of Round{" "}
                  {DEMO_START_ROUND}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep playing</AlertDialogCancel>
                <AlertDialogAction onClick={reset}>Reset demo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
