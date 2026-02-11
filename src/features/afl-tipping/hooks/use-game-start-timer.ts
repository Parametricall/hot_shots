import { useEffect, useState } from "react";
import { GAME_STATUS_CHECK_INTERVAL_MS } from "~/features/afl-tipping/constants";

// setTimeout uses a 32-bit signed int, max ~24.8 days. Use 1 day as safe limit.
const MAX_SAFE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function useGameStartTimer(gameUnixTime: number): boolean {
  const [hasStarted, setHasStarted] = useState(() => Date.now() >= gameUnixTime);

  useEffect(() => {
    if (gameUnixTime <= Date.now()) {
      setHasStarted(true);
      return;
    }

    // Game hasn't started - reset state
    setHasStarted(false);

    const timeUntilStart = gameUnixTime - Date.now();

    // Only set up the precise timer if within safe setTimeout range.
    // The interval check will handle games further in the future.
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    if (timeUntilStart <= MAX_SAFE_TIMEOUT_MS) {
      startTimer = setTimeout(() => {
        setHasStarted(true);
      }, timeUntilStart);
    }

    const checkInterval = setInterval(() => {
      if (Date.now() >= gameUnixTime) {
        setHasStarted(true);
      }
    }, GAME_STATUS_CHECK_INTERVAL_MS);

    return () => {
      if (startTimer) {
        clearTimeout(startTimer);
      }
      clearInterval(checkInterval);
    };
  }, [gameUnixTime]);

  return hasStarted;
}
