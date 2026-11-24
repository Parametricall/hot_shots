/**
 * Which time zone the site shows times in (docs/adr/0008). The viewer's own, so a Game's time
 * matches their clock. The server can't see the browser's zone, so for the first render it takes,
 * in order: the cookie the browser wrote on an earlier visit, Vercel's guess from the request's
 * IP, then Brisbane, where the Tipsters are. `useTimeZone` swaps in the browser's zone straight
 * after hydration, in case the server's pick was wrong.
 */

/** Where the Tipsters are: the zone for a request with no cookie and no IP guess. */
export const FALLBACK_TIME_ZONE = "Australia/Brisbane";

/** Holds the browser's IANA zone, for the server to read on the next request. */
export const TIME_ZONE_COOKIE = "hs_tz";

/** Vercel's IP geolocation header: an IANA zone such as "Australia/Brisbane". */
export const IP_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** An IANA zone `Intl` accepts. Cookies and headers come from outside, so check before use. */
export function isTimeZone(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The first valid zone of `candidates`, in order, else `FALLBACK_TIME_ZONE`. */
export function pickTimeZone(...candidates: (string | undefined)[]): string {
  return candidates.find(isTimeZone) ?? FALLBACK_TIME_ZONE;
}

/** The zone the browser's clock is set to. */
export function browserTimeZone(): string {
  return pickTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/** Write the browser's zone to the cookie, if it isn't there already. Browser only. */
export function rememberTimeZone(): void {
  const timeZone = browserTimeZone();
  const current = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${TIME_ZONE_COOKIE}=`))
    ?.slice(TIME_ZONE_COOKIE.length + 1);
  if (current && decodeURIComponent(current) === timeZone) return;
  document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
