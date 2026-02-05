import { useEffect, useState } from "react";
import { GAME_STATUS_CHECK_INTERVAL_MS } from "~/features/afl-tipping/constants";

export function useGameStartTimer(gameUnixTime: number): boolean {
  const [hasStarted, setHasStarted] = useState(() => Date.now() >= gameUnixTime);

  useEffect(() => {
    if (gameUnixTime <= Date.now()) {
      setHasStarted(true);
      return;
    }

    const timeUntilStart = gameUnixTime - Date.now();
    const startTimer = setTimeout(() => {
      setHasStarted(true);
    }, timeUntilStart);

    const checkInterval = setInterval(() => {
      if (Date.now() >= gameUnixTime) {
        setHasStarted(true);
      }
    }, GAME_STATUS_CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(startTimer);
      clearInterval(checkInterval);
    };
  }, [gameUnixTime]);

  return hasStarted;
}
