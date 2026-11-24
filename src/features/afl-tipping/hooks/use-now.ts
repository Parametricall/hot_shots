import { useEffect, useState } from "react";
import { useDemoClock } from "~/features/afl-tipping/demo/use-demo-clock";
import { now } from "~/lib/clock";

/**
 * The site's clock, epoch ms, re-read every `intervalMs` so a countdown ticks. In the Demo the
 * clock only moves when the Time control moves it, so no timer runs there.
 */
export function useNow(intervalMs = 30_000): number {
  const demoNow = useDemoClock();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (demoNow !== undefined) return;
    const id = setInterval(() => setTick((tick) => tick + 1), intervalMs);
    return () => clearInterval(id);
  }, [demoNow, intervalMs]);

  return demoNow ?? now();
}
