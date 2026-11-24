# Times show in the viewer's time zone, picked on the server before the first render

A Game's start time, its day heading and the status line's "Next game" all show in the viewer's
own time zone, so they match the clock on their phone. The server can't see the browser's zone,
and the pages render on the server first, so the root loader picks one from the request
(`src/lib/request-time-zone.ts`), in this order:

1. the `hs_tz` cookie, which the browser writes with its own zone after every load
2. Vercel's `x-vercel-ip-timezone` header, a guess from the request's IP
3. `Australia/Brisbane`, where the Tipsters are

`useTimeZone()` (`src/lib/use-time-zone.tsx`) returns that pick while the page renders on the
server and hydrates, then the browser's own zone. When the two differ, which only happens on a
first visit whose IP guess was wrong, React re-renders with the browser's zone instead of
reporting a hydration mismatch.

## Considered options

| Option                                         | Why not                                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Melbourne time everywhere, as the AFL lists it | A Brisbane Tipster sees 7:30pm for a 6:30pm bounce during daylight saving, and has to know which zone the site means                     |
| Format with the runtime's zone (as before)     | The server's zone is UTC on Vercel, so the server and the browser render different text and hydration fails                              |
| Render times only after hydration              | Every time flashes from a placeholder, on every load                                                                                     |
| `suppressHydrationWarning`                     | React 19 keeps the server's text, so the wrong time stays on screen                                                                      |
| Cookie, IP guess, then a fallback (chosen)     | Right from the first render for nearly everyone; a first-time visitor whose IP is placed in the wrong zone sees one swap after hydration |

## Consequences

- **Formatters take the zone as an argument** (`formatTime`, `groupGamesByDate`,
  `formatGameStart`, `roundStatusText`) and components pass `useTimeZone()`. A new formatter that
  reads the runtime's zone brings the hydration mismatch back.
- **Days are the viewer's days.** `groupGamesByDate` keys a Game by the date it starts on in the
  zone, so a Perth Tipster's heading for a 10am-Melbourne Game is that same day, not UTC's.
- **The Season summary, the Demo time control and the Season's year still use Melbourne.** They
  show dates, or decide which Season it is, where an hour's difference doesn't change the answer.
- **Local dev gets no IP header**, so a first load there renders in Brisbane until the cookie is
  set.
- **If the Tipsters move**, change `FALLBACK_TIME_ZONE` in `src/lib/time-zone.ts`. It only
  matters for a first visit with no IP guess.
