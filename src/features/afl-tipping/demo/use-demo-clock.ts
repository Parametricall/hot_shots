import { useSyncExternalStore } from "react";
import { getDemoNow, subscribeDemoNow } from "~/lib/clock";

/**
 * The Demo clock, epoch ms, or `undefined` when the real clock is in use. Never
 * pass `now` as the snapshot getter: `Date.now()` changes on every call, and
 * `useSyncExternalStore` would loop.
 */
export function useDemoClock(): number | undefined {
  return useSyncExternalStore(subscribeDemoNow, getDemoNow, getDemoNow);
}
