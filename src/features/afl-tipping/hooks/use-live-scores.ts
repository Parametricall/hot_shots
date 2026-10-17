import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import serviceRegistry from "~/app/service-registry";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import {
  GAME_STATUS_CHECK_INTERVAL_MS,
  LIVE_POST_START_WINDOW_MS,
} from "~/features/afl-tipping/constants";
import type { AflGame } from "~/features/afl-tipping/types";
import * as AflGameUtils from "~/features/afl-tipping/utils/afl-game";
import { writeLiveGameUpdateToCache } from "~/features/afl-tipping/utils/live-game-update";
import { now } from "~/lib/clock";

// Only keep a clock running when a Game could go live within a day: the connection opens when a
// start time passes without any re-render, but there is nothing to watch for further out.
const CLOCK_HORIZON_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps the Games' live fields (scores, game clock, completion) current while a Game
 * is live or about to start, by subscribing to the live scores service. Updates go
 * straight into the cached lists of Games, so the cards re-render with no refetch.
 *
 * It is mounted once, in the tipping page shell. It stops by itself: when the last
 * Game completes, `games` changes, `shouldConnect` flips and the cleanup unsubscribes.
 */
export function useLiveScores(games: AflGame[]): void {
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState(() => now());

  const shouldConnect = games.some((game) => AflGameUtils.isLiveOrImminent(game, nowMs));
  const needsClock = games.some(
    (game) =>
      !AflGameUtils.isComplete(game) &&
      game.unixTime - nowMs <= CLOCK_HORIZON_MS &&
      nowMs - game.unixTime <= LIVE_POST_START_WINDOW_MS,
  );

  useEffect(() => {
    if (!needsClock) return;
    setNowMs(now());
    const timer = setInterval(() => setNowMs(now()), GAME_STATUS_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [needsClock]);

  useEffect(() => {
    if (!shouldConnect) return;
    return serviceRegistry.getService("liveScoresService").subscribe({
      onUpdate: (update) => writeLiveGameUpdateToCache(queryClient, update),
      // After a reconnect, updates may have been missed: refetch every list of Games.
      onResync: () => {
        void queryClient.invalidateQueries({ queryKey: aflQueries.allGamesKey() });
      },
    });
  }, [shouldConnect, queryClient]);
}
