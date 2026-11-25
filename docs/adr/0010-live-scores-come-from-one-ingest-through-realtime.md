# Live scores come from one ingest on Squiggle's Event API and reach browsers through Supabase Realtime

Game cards show live scores, the game clock and completion. Each open tab used to hold its own
connection to Squiggle's Event API through our relay (`docs/adr/0005`), so Squiggle connections
and Vercel functions grew with the number of open tabs.

Now one **live ingest** (`src/features/afl-tipping/sync/live-ingest.ts`) holds the site's only
Event API connection, while a Game is live or about to start: from 30 minutes before a Game's start
until it completes, or six hours after the start. It writes the five live fields (`home_score`,
`away_score`, `time_str`, `complete`, `winner_team_id`) to `afl_games`. A trigger on `afl_games`
calls `realtime.send` when one of them changes, and every signed-in tab receives the change on
one private Realtime channel, `afl:live-games`. No visitor action causes a Squiggle request
(`docs/adr/0009`).

The ingest runs in a Vercel function, `POST /api/sync/live-scores`, about 5 minutes at a time.
`pg_cron` calls it every minute while a Game is live or imminent, unless a run holds the lease
(`squiggle_live_lease`, one row). A run takes the lease for 295 seconds, holds one connection for
about 290, gives the lease up and ends. The next tick starts the next run. When it connects,
Squiggle sends a `game` event with each live Game's state, so the gap of up to a minute between
runs loses nothing. `runLiveIngest({ signal, deadline })` imports nothing from Vercel, so it can
run on another host without a rewrite.

Only signed-in people can receive. A server function, `getRealtimeToken`, hands the browser the
session's short-lived access token and the publishable key, never the refresh token. The policy on
`realtime.messages` lets `authenticated` select on topic `afl:live-games` and nothing else. There
is no insert policy, so no browser can send. The browser still never reads a table
(`docs/adr/0002`).

## Considered options

| Option                                                          | Why not                                                                                                                                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep the per-tab relay (`docs/adr/0005`), fed from the database | Each tab still holds a Vercel function, and the route would need a pub/sub to listen to, which is Realtime anyway                                                             |
| Poll our own CDN-cached endpoint every 15 seconds               | Simple, with no Supabase in the browser, but up to about 25 seconds of lag. It stays the fallback if Realtime proves unworkable                                               |
| Poll Squiggle's Standard API with `live=1`                      | Squiggle forbids it, and its Games data is up to 60 seconds old                                                                                                               |
| An always-on worker (Fly.io, Railway, a small VPS)              | One unbroken connection and no gaps, but a new vendor, about $5 a month, and its own deploys and monitoring. Revisit if Squiggle objects to the connections, or the gaps show |
| Let `anon` receive                                              | Simpler, and scores aren't secret, but anyone with the publishable key could use up our Realtime connection quota (200 on the free plan)                                      |
| Vercel runs the ingest, Realtime delivers, signed-in only       | Chosen: one Squiggle connection for the site, no function held open per tab, and the same audience as the old route, which checked the session                                |

## Consequences

- **About 12 Squiggle connections an hour during Games.** A run lasts about 5 minutes. Squiggle
  asks clients to handle disconnection and reconnection, and sends its own heartbeat every 10
  seconds. If Squiggle objects, the always-on worker is the next step: the ingest module needs only
  a new entrypoint.
- **A gap of up to about 60 seconds between runs** can miss an event. The `game` snapshot
  Squiggle sends on connect closes it. A run that dies leaves the lease to expire at 295 seconds.
- **The ingest's Vercel limits.** The endpoint has `maxDuration: 300` in `vite.config.ts`
  (`vercel.functionRules`), and the ingest stops 10 seconds before the platform's deadline so it
  can release the lease. That `waitUntil` work is held to that limit, not cut earlier, is only
  proved at the first live Game.
- **The token expires, so the browser refreshes it.** About 5 minutes before expiry the service
  fetches a new token and calls `setAuth`, which keeps the channel. After expiry the server closes
  the channel, and `setAuth` can't bring it back. So on `CLOSED`, `CHANNEL_ERROR` or `TIMED_OUT` it
  removes the channel, waits (2 seconds, doubling to 60), fetches a token, joins a new channel and
  resyncs by invalidating the Games queries. A tab that slept through expiry takes that path. If
  the fetch says the person is signed out, it stops retrying.
- **`realtime.messages` has one policy**, a `select` for `authenticated` on `afl:live-games`
  (`docs/adr/0002`). It also checks that the extension is `broadcast`.
- **"Allow public access" must be off in the hosted Realtime settings**, so only private channels
  exist. Local Supabase can't show this: check it on the hosted project.
- **A Realtime message is a cache nudge, not the source of truth.** A tab that misses one is
  corrected by the resync, and by the Games query going stale after a minute.
- **Quota.** The free plan allows 200 concurrent Realtime connections, one per open tab. Past
  that, new tabs get no live updates; their Games still refresh from our database.
- **`VITE_LIVE_SCORES=relay` brings the old per-tab relay back** as a fallback until plan 015
  Step 13 deletes it and this variable. After that, only `docs/adr/0005`'s record of it remains.
- **The Demo is unchanged.** It registers a no-op live scores service, as before.
