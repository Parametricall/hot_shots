import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { browserTimeZone, FALLBACK_TIME_ZONE, rememberTimeZone } from "~/lib/time-zone";

/** The zone the server rendered in. Only read while the page renders on the server and hydrates. */
const ServerTimeZoneContext = createContext(FALLBACK_TIME_ZONE);

type TimeZoneProviderProps = {
  /** The server's pick for this request, from the root loader. */
  serverTimeZone: string;
  children: ReactNode;
};

/** Hands the server's zone to `useTimeZone`, and writes the browser's to a cookie for next time. */
export function TimeZoneProvider({ serverTimeZone, children }: TimeZoneProviderProps) {
  useEffect(function rememberBrowserTimeZone() {
    rememberTimeZone();
  }, []);

  return (
    <ServerTimeZoneContext.Provider value={serverTimeZone}>
      {children}
    </ServerTimeZoneContext.Provider>
  );
}

const subscribe = () => () => {};

// React reads the snapshot on every render; the browser's zone won't change under an open page.
let cachedBrowserTimeZone: string | undefined;
const getBrowserTimeZone = () => (cachedBrowserTimeZone ??= browserTimeZone());

/**
 * The IANA zone to show times in. The server's pick while the page renders on the server and
 * hydrates, so both render the same text; the browser's own straight after, which React swaps in
 * without a hydration error if the two differ.
 */
export function useTimeZone(): string {
  const serverTimeZone = useContext(ServerTimeZoneContext);
  return useSyncExternalStore(subscribe, getBrowserTimeZone, () => serverTimeZone);
}
