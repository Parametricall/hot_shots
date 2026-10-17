/**
 * The site's clock. Production reads `Date.now()`. The Demo (docs/adr/0004)
 * replaces it with the Demo clock: a moment in a past Season that the Time
 * control moves, and that every Lockout check then reads instead of the real
 * time. Production never calls `setDemoNow`, so `now()` is `Date.now()` there.
 */

let demoNow: number | undefined;
const listeners = new Set<() => void>();

/** The current time, epoch ms: the Demo clock if it is set, else the real clock. */
export function now(): number {
  return demoNow ?? Date.now();
}

/** The Demo clock, or `undefined` when the real clock is in use. */
export function getDemoNow(): number | undefined {
  return demoNow;
}

export function setDemoNow(at: number): void {
  if (demoNow === at) return;
  demoNow = at;
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore`. */
export function subscribeDemoNow(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
