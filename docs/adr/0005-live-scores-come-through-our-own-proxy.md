# Live scores reach the browser through our own `/api/live-scores` route

Game cards show live scores, the game clock and completion from Squiggle's Event API (SSE,
`sse.squiggle.com.au/events`). The browser opens one `EventSource` on `/api/live-scores`, a server
route that checks the session and relays Squiggle's stream. Only the `events` and `test`
channels can be asked for, and the route adds a heartbeat so idle connections aren't cut between
scoring events. A hook mounted once in the tipping page shell writes each update straight into the
cached lists of Games, and unsubscribes by itself when the last Game completes. It reaches the
stream through the service registry (`liveScoresService`), so the Demo (`docs/adr/0004`) registers
a no-op in its place: its Games finish when the Demo clock passes them.

## Considered options

| Option                                     | Why not                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser `EventSource` straight to Squiggle | Squiggle allowlists origins. `localhost:3000` works, arbitrary production origins get a 403. Would work in dev and silently never in production      |
| Poll the REST API on an interval           | Squiggle asks for no one-shot fetches against live data, scores would lag by the interval, and every open tab would poll whether or not a Game is on |
| Relay through our own route (chosen)       | Server-to-server requests have no Origin header and aren't blocked; the session check stops it being an open proxy                                   |

## Consequences

- **Each open tab holds one connection**, only from 30 minutes before a Game's start until it
  completes (or six hours after the start, so a Game that never completes can't hold one open for
  ever). The function's `maxDuration` is set to 300 seconds in `vite.config.ts`
  (`vercel.functionRules`). When Vercel cuts the stream the browser reconnects and the hook
  resyncs by invalidating the Games queries, so a cut loses nothing.
- **Only the five live fields are written**: `homeScore`, `awayScore`, `timeStr`, `complete` and
  `winnerTeamId`. A Game that completes without a winner gets one from the scores.
- **Event shapes other than `score` are from Squiggle's docs, not from the wire.** `sse-schemas.ts`
  parses leniently and marks the gap `TODO(sse-pin)`. Pin them against a live Game; the `game`
  snapshot Squiggle sends on connect and the resync make a wrong guess non-fatal.
- **The simplification to keep in mind.** If Squiggle allowlists the production domain, the
  service can point `EventSource` at Squiggle directly and the route and `maxDuration` can go. The
  `LiveScoresService` type stays the same, so it is a one-file swap.
