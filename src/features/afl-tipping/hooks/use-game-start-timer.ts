import { useEffect, useState } from "react";
import { GAME_STATUS_CHECK_INTERVAL_MS } from "~/features/afl-tipping/constants";
import { useDemoClock } from "~/features/afl-tipping/demo/use-demo-clock";
import { now } from "~/lib/clock";

// setTimeout uses a 32-bit signed int, max ~24.8 days. Use 1 day as safe limit.
const MAX_SAFE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function useGameStartTimer(gameUnixTime: number): boolean {
  const demoNow = useDemoClock();
  const [hasStarted, setHasStarted] = useState(() => now() >= gameUnixTime);

  useEffect(() => {
    // In the Demo the clock only moves when the Time control moves it, so a
    // real-time timer would lock a Game after real milliseconds pass, wrongly.
    if (demoNow !== undefined) {
      setHasStarted(demoNow >= gameUnixTime);
      return;
    }

    if (gameUnixTime <= now()) {
      setHasStarted(true);
      return;
    }

    // Game hasn't started - reset state
    setHasStarted(false);

    const timeUntilStart = gameUnixTime - now();

    // Only set up the precise timer if within safe setTimeout range.
    // The interval check will handle games further in the future.
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    // Re-check the clock when the timer fires: a timer can fire a hair early,
    // and only a clock that has reached the start may lock the Game.
    const scheduleStart = (delay: number) => {
      startTimer = setTimeout(() => {
        const remaining = gameUnixTime - now();
        if (remaining <= 0) {
          setHasStarted(true);
        } else {
          scheduleStart(remaining);
        }
      }, delay);
    };
    if (timeUntilStart <= MAX_SAFE_TIMEOUT_MS) {
      scheduleStart(timeUntilStart);
    }

    const checkInterval = setInterval(() => {
      if (now() >= gameUnixTime) {
        setHasStarted(true);
      }
    }, GAME_STATUS_CHECK_INTERVAL_MS);

    return () => {
      if (startTimer) {
        clearTimeout(startTimer);
      }
      clearInterval(checkInterval);
    };
  }, [gameUnixTime, demoNow]);

  return hasStarted;
}
