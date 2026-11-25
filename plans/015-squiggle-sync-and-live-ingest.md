# Plan 015: Read Squiggle on a schedule, serve visitors from our own copy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. Steps marked **OPERATOR** need a decision or a
> dashboard only the operator has: stop, say exactly what is needed, and
> wait. When done, update the status row for this plan in `plans/README.md`,
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git log --oneline 338b9ca..HEAD -- src/features/afl-tipping/api src/routes/api supabase vite.config.ts`.
> If plan 014 has merged, that's expected: re-check the "Current state" table
> against the code. If anything else has changed how Squiggle is called,
> re-check before Step 3.

## Status

- **Priority**: P1. It must be live before Opening Round 2027 (early March).
  Squiggle updated its terms (`api.squiggle.com.au`, "Requirements"), and
  the app breaks them as it stands (see "Why this matters").
- **Effort**: L
- **Risk**: MED. Every Squiggle read moves to a new place, and the live
  path can only be proved at a real Game. Squiggle's `/test` channel covers
  the code, but not Squiggle's real behaviour on a Game day.
- **Depends on**: plan 013 Step 8 (Supabase Auth in production) and plan 014
  (Season-aware services). Branch from 014's work, or from `main` once it
  has merged.
- **Category**: compliance / architecture
- **Planned at**: commit `338b9ca`, 2026-11-25, from the operator's request
  after reading Squiggle's updated requirements: "I don't want a cheap fix
  now, I have time before next season to build this out properly."

## Why this matters

Squiggle's requirements, in short:

- Identify yourself with a User-Agent that has a contact email.
- Cache and re-use data. Don't ask for the same thing again and again.
- Don't fetch more than you need.
- Test and monitor the bot so it can't spin out of control.
- Don't make visitors fetch from Squiggle. "You, the builder, should fetch
  data. The Squiggle API is not a free production database backend for
  third-party user-facing sites."
- Don't use the Standard API as if it were the Event API by re-fetching the
  same data. Don't use the Event API for one-off fetches either.

Browsers never call Squiggle today, so the letter of the last rule is met.
The spirit isn't. Our server passes every request straight through, so
Squiggle traffic grows with every visitor, every tab and every refocus:

| What causes it            | Squiggle requests today                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| One visitor opens My Tips | ~4 identical full-Season `games` fetches (the games query, `getTips`, `getLeaderboard`, `getPlayerStats`), plus Seasons |
| Refocusing the tab        | Another full-Season fetch (`refetchOnWindowFocus: "always"`, `queries.ts`)                                              |
| A live Game, per open tab | One Event API connection, and a full-Season refetch every ~5 min when Vercel cuts the stream and the hook resyncs       |
| Submitting one Tip        | The whole Season's Games, to check one Game (`tips.ts`, `submitTip`)                                                    |
| Squiggle errors           | Up to 3 client retries per query, each passed through to Squiggle                                                       |
| User-Agent                | `parametricall@users.noreply.github.com`, an address nobody reads                                                       |

## The model

After this plan, **no visitor action causes a Squiggle request.** Two
server-side jobs read Squiggle, and everything else reads our database:

```
                       pg_cron (Supabase), every minute
                           │ only if work is due
                           ▼
  Squiggle Standard API ◄── /api/sync/squiggle ──► afl_games, afl_model_tips,
  (hourly at most)                                  afl_ladder, afl_teams
                                                         │
  Squiggle Event API ◄──── /api/sync/live-scores ──► afl_games (live fields)
  (one connection)                                       │ trigger
                                                         ▼
                                              Supabase Realtime broadcast
                                                         │
  Browsers ── server functions read the tables ──────────┘ live updates push
```

- **Squiggle sync**: a job that runs a few Standard API requests on a
  schedule and upserts the results. Its schedule depends on what's in the
  database, not on visitors.
- **Live ingest**: one Event API connection for the whole site, held only
  while a Game is live or about to start. It writes live fields to
  `afl_games`. A trigger broadcasts each change to every open tab.

Neither is a domain term, so neither goes into `GLOSSARY.md`. Use these
names in code, logs and docs.

### Request budget

| Data         | When it's fetched                                                                                                  | Squiggle query                                   | Requests a day          |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ----------------------- |
| Fixture      | Hourly in-Season, Games not yet complete only. Daily full reconcile. Daily off-Season. A Season that's over: never | `q=games;year=Y;complete=!100`, `q=games;year=Y` | ≤ 25                    |
| Next Fixture | Daily, until Squiggle has Games for next year                                                                      | `q=games;year=Y+1`                               | 1                       |
| Model tips   | Hourly for the Round(s) with a Game starting in the next 7 days. Daily otherwise                                   | `q=tips;year=Y;round=R;source=1`                 | ≤ 48                    |
| Ladder       | 10 minutes after a Game completes (Squiggle delays standings by up to 5). Daily reconcile in-Season                | `q=standings;year=Y`                             | ≤ 10                    |
| Teams        | Weekly, or when a Game names a team we don't have                                                                  | `q=teams`                                        | < 1                     |
| Live         | One connection while any Game is live or starts within 30 minutes                                                  | `sse.squiggle.com.au/events`                     | ~12 connections an hour |

That's under 100 Standard API requests a day in-Season, whatever the
number of Tipsters.

## Current state (verified at `338b9ca`)

| Where                                                  | What it does today                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `src/features/afl-tipping/api/squiggle/api.ts`         | `fetch*` functions call Squiggle and throw on a non-ok response. No cache.                                              |
| `src/features/afl-tipping/api/squiggle/constants.ts`   | `SQUIGGLE_USER_AGENT` hard-codes a GitHub no-reply address.                                                             |
| `src/features/afl-tipping/api/squiggle.serverfns.ts`   | One server function per `SquiggleService` method, each a pass-through. Seasons cached 1 minute per server instance.     |
| `src/features/afl-tipping/api/squiggle.service.ts`     | Registered as `squiggleService` in `router.tsx`.                                                                        |
| `src/features/afl-tipping/api/seasons.ts`              | `loadSeasons(deps)` takes `fetchIncompleteGames` and `fetchGames`, so its source can be swapped.                        |
| `src/features/afl-tipping/api/tips.ts`                 | `submitTip`, `getTips`, `getLeaderboard`, `getGroupTips`, `getPlayerStats` call `squiggleService.getGames` server-side. |
| `src/features/afl-tipping/api/sse-proxy.ts`            | Relays Squiggle's Event API with a heartbeat.                                                                           |
| `src/routes/api/live-scores.ts`                        | Checks the session, then relays. One upstream connection per open tab.                                                  |
| `src/features/afl-tipping/api/live-scores.service.ts`  | One `EventSource` per tab on `/api/live-scores`. Calls `onResync` after a reconnect.                                    |
| `src/features/afl-tipping/hooks/use-live-scores.ts`    | Subscribes while a Game is live or imminent. `onResync` invalidates the Games queries.                                  |
| `src/features/afl-tipping/api/squiggle/sse-schemas.ts` | `parseSseEvent` turns Squiggle events into `LiveGameUpdate`.                                                            |
| `vite.config.ts`                                       | `functionRules: { "/api/live-scores": { maxDuration: 300 } }`.                                                          |
| `src/app/service-registry.ts`                          | `SquiggleService` and `LiveScoresService` are named types. The Demo registers its own.                                  |
| Vercel                                                 | Personal (Hobby) account: cron jobs run at most once a day, functions for at most 300 s.                                |

## Decisions

The operator confirmed D1–D7 on 2026-11-25. Raise one with the operator only if a spike
(Step 2) proves it wrong.

- **D1. Visitors never cause a Squiggle request.** Only the Squiggle sync
  and the live ingest call Squiggle. Every read, server-side or browser,
  comes from Supabase.
  _Rejected_: a shared cache in front of the existing pass-through (Vercel
  Runtime Cache or `s-maxage`). It cuts traffic a lot, but Squiggle traffic
  still grows with users, every cache miss is a visitor waiting on
  Squiggle, and a Squiggle outage is our outage.
- **D2. Supabase `pg_cron` + `pg_net` is the scheduler.** It calls our own
  endpoints with a shared secret. The job's SQL checks the database first,
  so it only makes an HTTP call when work is due. Both extensions are on
  Supabase's free plan.
  _Rejected_: Vercel Cron. On Hobby it runs once a day, which is too rare
  for live Games. Pro ($20/month) runs every minute and would be a fine
  swap: the endpoints stay the same. GitHub Actions `schedule`: runs are
  often delayed 10–30 minutes. Doing the work in a Supabase Edge Function:
  it's Deno, so a second codebase that can't share our Zod schemas, and the
  free plan caps it at 150 s.
- **D3. The live ingest runs in a Vercel function, one at a time, about 5
  minutes per run.** `pg_cron` starts it each minute while a Game is live
  or imminent, unless a run holds the lease. A run holds one connection to
  `sse.squiggle.com.au/events` for up to ~290 s, then gives up the lease.
  The next minute's tick starts the next run. On connect Squiggle sends a
  `game` event with each Game's state, so the gap of up to a minute between
  runs loses nothing. The ingest code is a module that knows nothing about
  Vercel (`runLiveIngest({ signal, deadline })`). Moving it to an always-on
  host later means adding an entrypoint, not rewriting it.
  _Rejected for now_: an always-on worker (Fly.io, Railway, a small VPS).
  One unbroken connection and no gaps, but a new vendor, about $5/month,
  and its own deploys and monitoring. Revisit if Squiggle objects to ~12
  connections an hour, or the gaps show. Polling the Standard API with
  `live=1`: Squiggle forbids that, and its games data is up to 60 s old.
- **D4. Live updates reach browsers through Supabase Realtime.** An
  `afl_games` trigger calls `realtime.send` when a live field changes. The
  browser subscribes to one private channel. That's one Squiggle connection
  for the whole site, and no Vercel function held open per tab. This uses
  the exception ADR 0002 already allows: "Anything that needs the browser
  to reach Supabase directly (Realtime, say) must add explicit policies for
  exactly that table and operation."
  _Rejected_: keeping `/api/live-scores` per tab, fed from the database.
  Each tab still holds a Vercel function, and the route still needs a
  pub/sub to listen to, which is Realtime anyway. The browser polling our
  own CDN-cached endpoint every 15 s: simple, with no Supabase in the
  browser, but up to ~25 s of lag. It is the fallback if Step 2c fails.
- **D5. Only signed-in people can receive live updates.** A server function
  hands the browser the session's short-lived access token, never the
  refresh token. The Realtime policy allows `authenticated` to receive
  (select) on topic `afl:live-games` and nothing else. Nobody can send.
  That matches today's route, which checks the session.
  _Rejected_: letting `anon` receive. Simpler, and scores aren't secret.
  But anyone with the publishable key could use up our Realtime connection
  quota (200 on the free plan).
- **D6. The User-Agent's contact email comes from `SQUIGGLE_CONTACT_EMAIL`**,
  a server-only variable with no `VITE_` prefix. It's never hard-coded in
  the repo, which is public. The sync refuses to run without it.
- **D7. Guardrails stop the bot spinning out of control.** Every run is
  recorded in `squiggle_sync_runs`. A run has a request budget (10). The
  day has a request budget (300). After a failure the job backs off: 1, 2,
  4 … up to 60 minutes. A response that fails its Zod schema writes
  nothing, and the job backs off as if Squiggle had failed. The last good
  data stays.

## Scope

In:

- New tables `afl_games`, `afl_model_tips`, `afl_ladder`, `afl_teams`,
  `squiggle_sync_runs`, `squiggle_live_lease`, with RLS on.
- The Squiggle sync, the live ingest, their endpoints and their schedule.
- `squiggleService`'s server functions read the tables instead of Squiggle.
  `SquiggleService`'s type doesn't change, so the Demo and the pages don't
  either.
- The browser's `LiveScoresService` moves to Supabase Realtime.
- Removing `/api/live-scores` and `sse-proxy.ts`, after Opening Round (Step 13).
- ADRs, `AGENTS.md`, `docs/`.

Out (record in "Notes" if the operator wants them):

- Renaming `squiggleService` now that it reads our database. It touches the
  Demo and every caller for no behaviour change.
- An admin page for sync health. Step 11 adds SQL to check it by hand.
- Live ingest for team-specific channels. `/events` covers every Game.

## Git workflow

Branch `advisor/015-squiggle-sync`. Commit after each step whose checks pass,
following `AGENTS.md` ("Commits"). Scopes: `supabase` for migrations,
`afl-tipping` for the feature, `routes` for endpoints, `repo` for docs. Don't
push. The operator does.

## Steps

### Step 1: OPERATOR — decisions and secrets

1. ~~Confirm D1–D7.~~ Done 2026-11-25: all confirmed as written.
2. ~~Pick the contact email for the User-Agent (D6).~~ Done 2026-11-25: the
   operator's personal Gmail with a `+squiggle` tag. It lives only in
   `SQUIGGLE_CONTACT_EMAIL` (Vercel and local `.env`). Never write it into
   the repo, a test or a log line.
3. ~~Confirm the production URL the scheduler should call.~~ Done
   2026-11-25: `https://www.hot-shots.dev`. The bare `hot-shots.dev` answers
   with a 307 to it, so the Vault secret `app_url` must be the `www` form,
   with no trailing slash.

Step 1 is done.

### Step 2: Spikes (throwaway code, findings go in "Notes")

Prove the assumptions the design rests on. Don't commit spike code.

a. **Squiggle Event API.** Connect to `https://sse.squiggle.com.au/test`
with the real User-Agent, then to `/events`. Record what arrives on
connect: is there one `game` event per live Game, and none when no Game
is live? Are there `id:` lines? (Squiggle's docs show them but say
nothing about `Last-Event-ID`.) Check `parseSseEvent` handles every
event name seen. Off-Season, `/events` may send nothing. Say so, and
rely on `/test` for shapes.
b. **Vercel, from `pg_net`.** Deploy a preview with a POST endpoint that
returns `202` at once, then keeps working through `waitUntil` (from
`@vercel/functions`, or whatever Nitro exposes on Vercel) for 280 s,
logging every 30 s. Call it with `net.http_post` from the Supabase SQL
editor with `timeout_milliseconds := 5000`. Check that the function runs
to the end after `pg_net` stops waiting, and that `maxDuration: 300`
applies to the route (`functionRules` in `vite.config.ts`).
c. **Realtime, signed in, from the browser.** On local Supabase: a trigger
calls `realtime.send(payload, 'live-game', 'afl:live-games', true)`.
A policy on `realtime.messages` allows `select` to `authenticated` where
`realtime.topic() = 'afl:live-games'`. A server function returns the
session's access token. In the browser, a `RealtimeClient` from
`@supabase/realtime-js` (not `createClient`, which would bring auth-js
and its cookie handling into the bundle) calls `setAuth(token)` and
joins the private channel. Check:

- an update to a row reaches the browser;
- a signed-out browser (anon key only) is refused;
- a client can't `send` on the topic;
- what happens when the 1-hour token expires mid-Game, and how to
  refresh it (call the server function again, then `setAuth`).
  Check the free plan's current Realtime quotas in the Supabase dashboard,
  and record them.

**STOP** if (b) fails: the function stops when `pg_net` disconnects and
there's no way to keep it running. D3 then needs the always-on worker or
Vercel Pro. **STOP** if (c) can't keep signed-out browsers out. D5 then
needs the operator to choose `anon` or the polling fallback from D4.

### Step 3: Migration — tables

`supabase/migrations/<timestamp>_squiggle_sync.sql`. Every table gets
`enable row level security` and no policies (ADR 0002). Store what the
domain types need, plus what the sync needs to decide what to do:

- `afl_teams`: `id` (Squiggle team id, PK), `name`, `abbrev`, `logo`,
  `debut`, `synced_at`.
- `afl_games`: `id` (Squiggle game id, PK; unique across Seasons, plan 014
  Notes), `season`, `round`, `round_name`, the venue fields of `Venue`,
  `start_time timestamptz`, `home_team_id`, `away_team_id`, `home_score`,
  `away_score`, `winner_team_id`, `complete`, `time_str`, `is_finals`,
  `is_grand_final`, `squiggle_updated timestamptz` (Squiggle's `updated`),
  `live_updated_at timestamptz` (last write by the live ingest),
  `synced_at`. Index on `(season, round)` and on `start_time`.
- `afl_model_tips`: `game_id` (PK, FK to `afl_games`), `season`, `round`,
  `tip_team_id`, `confidence`, `home_confidence`, `away_confidence`,
  `synced_at`. Only the Model (source 1), so no source column.
- `afl_ladder`: `(season, team_id)` PK, the `AflStanding` fields, `synced_at`.
  It's the latest Ladder for each Season, overwritten on each sync.
- `squiggle_sync_runs`: `id`, `job` (`fixture` | `model-tips` | `ladder` |
  `teams` | `live`), `started_at`, `finished_at`, `ok boolean`, `reason
  text`, `detail text`, `requests int`. Index on `(job, started_at desc)`.
- `squiggle_live_lease`: a single row (`id int primary key check (id = 1)`),
  `holder uuid`, `expires_at timestamptz`.
- `acquire_squiggle_live_lease(holder uuid, seconds int) returns boolean`
  and `release_squiggle_live_lease(holder uuid)`, as SQL functions. **Revoke
  execute from `public`, `anon` and `authenticated`; grant it to
  `service_role` only.** Postgres lets `PUBLIC` execute new functions, and
  PostgREST exposes the `public` schema, so without the revoke anyone with
  the publishable key could take the lease.

**Verify**: `npx supabase db reset` locally applies it. With the
publishable key, `select` on each table returns no rows, and
`rpc('acquire_squiggle_live_lease', …)` is refused.

### Step 4: Squiggle client: identify, budget, don't throw

In `src/features/afl-tipping/api/squiggle/`:

- The User-Agent is built from `SQUIGGLE_CONTACT_EMAIL` (D6), for example
  `Hot Shots tipping - <email>`. Read it server-side only. If it's missing,
  the client returns `{ ok: false, reason: "no-contact-email" }` and makes
  no request. Add it to `.env.example` with no value.
- Each `fetch*` returns a result instead of throwing (AGENTS.md): `{ ok:
  true; games }`, `{ ok: true; tips }`, `{ ok: true; ladder }`, `{ ok:
  true; teams }`, or `{ ok: false; reason; detail? }`. Reasons:
  `http-<status>`, `network`, `parse` (Zod failed), `squiggle-error` (a
  200 whose body is `{"games":[{"error":…}]}`, as plan 014 found), and
  `budget`.
- A `createSquiggleClient({ budget })` counts requests and returns
  `reason: "budget"` once it's spent, without calling Squiggle.
- Rename the Standard API's "standings" to Ladder in our code
  (`fetchLadder`), per `GLOSSARY.md`. The Squiggle query is still
  `q=standings`.

Test-first: each reason above, the error body, the budget, and that the
User-Agent header carries the email.

**Verify**: `npm run test:ci`, `npm run typecheck`.

### Step 5: The sync plan (pure, test-first)

`src/features/afl-tipping/sync/plan-squiggle-sync.ts`:
`planSquiggleSync(state, now) → SquiggleRequest[]`. `state` is what the
database knows: each Season's Games (start times, `complete`,
`synced_at`), the latest run of each job, and recent failures. The plan
follows "Request budget":

- A Season whose Games are all complete, last synced after its last Game
  finished, is never fetched again.
- In-Season: incomplete Games hourly, a full reconcile daily.
- Next year's Fixture: daily, until it has Games.
- Model tips: Rounds with a Game starting in the next 7 days, hourly;
  otherwise daily for the earliest Round with an unstarted Game.
- Ladder: once a Game has completed since the last Ladder sync, after a 10
  minute delay; otherwise daily in-Season.
- Teams: weekly, or at once if a Game names an unknown team.
- Backoff (D7): after a failed run of a job, nothing for that job for 1, 2,
  4 … 60 minutes, by the number of failures in a row.
- The day's budget (D7): once 300 requests are recorded today (Melbourne
  time), the plan is empty.

Use `melbourneYear` from `seasons.ts` for "this year". Tests cover each rule,
the New Year boundary, and the off-Season (2026 over, 2027 Fixture out, no
Game for months).

**Verify**: `npm run test:ci`.

### Step 6: Writing the data

`src/features/afl-tipping/sync/`:

- `squiggle-sync.repository.ts`: upserts for each table and reads
  `state` for the plan. It goes through `getSupabaseServerClient()`.
- `run-squiggle-sync.ts`: loads the state, plans, runs each request through
  the budgeted client, upserts what succeeds, and records one
  `squiggle_sync_runs` row per job. A failed request writes nothing for
  that job.
- **Don't overwrite live data with older data.** For a Game whose
  `live_updated_at` is in the last 10 minutes, the fixture sync leaves
  `home_score`, `away_score`, `time_str`, `complete` and `winner_team_id`
  alone. Squiggle's Standard API is up to 60 s behind its Event API, so it
  would otherwise wind scores back. Pin this with a test.

**Verify**: `npm run test:ci`. Then against local Supabase, add a script
`npm run sync:squiggle`, which runs `runSquiggleSync` once with the local
env. Run it twice. The first fills 2026 and 2027. The second makes no more
than a few requests: check `squiggle_sync_runs`.

### Step 7: Endpoints and backfill

- `src/routes/api/sync/squiggle.ts`: `POST` only. It checks
  `Authorization: Bearer ${SQUIGGLE_SYNC_SECRET}` with a constant-time
  compare (401 otherwise), returns `202`, and runs `runSquiggleSync` in
  `waitUntil` (Step 2b). It takes no parameters: the plan decides what to
  do.
- `src/routes/api/sync/live-scores.ts`: the same check. It starts the live
  ingest (Step 9) in `waitUntil`. Move the `maxDuration: 300` rule in
  `vite.config.ts` from `/api/live-scores` to this route. Keep the old
  entry until Step 13.
- `SQUIGGLE_SYNC_SECRET` goes in `.env.example` (no value, no `VITE_`).
- The backfill is a first `npm run sync:squiggle` against production
  (Step 12). Nothing else.

**Verify**: locally, `curl -X POST` without the header gets 401. With it,
202, and a new run in `squiggle_sync_runs`.

### Step 8: Reads come from the database

- `squiggle.serverfns.ts`: each server function reads the tables through a
  new `squiggle-data.repository.ts`, which maps rows to `AflGame`,
  `AflModelTip`, `AflStanding` and `AflTeam`. No server function imports
  `squiggle/api.ts` any more. Check with
  `git grep -n "squiggle/api" -- src/features/afl-tipping/api src/routes`:
  only `sync/` may match.
- `getSeasons`: `loadSeasons` gets database-backed `fetchIncompleteGames`
  and `fetchGames`. Drop the per-instance 1-minute cache. A database read
  doesn't need it.
- `tips.ts` `submitTip`: read the one Game and its Model tip
  (`getGame(id)`, `getModelTip(gameId)`), not the whole Season.
- An empty table (nothing synced yet) returns an empty list and logs a
  warning. It never falls back to Squiggle.
- `queries.ts`: drop `refetchOnWindowFocus: "always"` on the Games query.
  The default (`true`, when stale) is enough now that live updates push.
  Client retries can stay: they hit our database, not Squiggle.
- Update the docblock of `SquiggleService` in `service-registry.ts`: it now
  serves Squiggle's data from our copy.

**Verify**: `npm run test:ci`, `npm run typecheck`, `npm run build`.
`npm run dev` after a local sync: My Tips, Group tips, Ladder and Stats
render as before. In the browser's network tab, and in the server log, no
request goes to `squiggle.com.au`.

### Step 9: The live ingest

`src/features/afl-tipping/sync/live-ingest.ts`:
`runLiveIngest({ signal, deadline })`, with no Vercel imports (D3).

1. Take the lease (`acquire_squiggle_live_lease`, 295 s). If it's held,
   record nothing and return.
2. Open `sse.squiggle.com.au/events` with the User-Agent from Step 4.
3. Parse each event with the existing `parseSseEvent`, and write the
   `LiveGameUpdate` to `afl_games` with `live_updated_at = now()`. Keep
   ADR 0005's rule: a Game that completes without a winner gets one from
   the scores.
4. On a dropped connection, reconnect after 2, 4, 8 … 30 s. Squiggle's docs
   say the Event API "rarely but occasionally restarts".
5. Stop at the deadline (~290 s), when `signal` aborts, or when no Game in
   the database is live or starts within 30 minutes. Release the lease and
   record one `live` run: `requests` is the number of connections opened.

Test-first, with a fake stream: event to row patch, the winner rule, the
deadline, reconnect backoff, and that a held lease means no connection.

**Verify**: `npm run test:ci`. Locally, point the URL at Squiggle's `/test`
channel and run it for a minute. Rows change and `live_updated_at` is set.
Undo that change before committing.

### Step 10: Migration — the broadcast, the policy, the schedule

`supabase/migrations/<timestamp>_squiggle_live_and_schedule.sql`:

- A trigger on `afl_games` `after update`. When any of the five live fields
  `is distinct from` its old value, it calls `realtime.send` with
  `{ gameId, homeScore, awayScore, timeStr, complete, winnerTeamId }`,
  event `live-game`, topic `afl:live-games`, private.
- A policy on `realtime.messages`: `for select to authenticated using
  (realtime.topic() = 'afl:live-games')`. No `insert` policy, so nobody can
  send.
- `create extension if not exists pg_cron` and `pg_net`.
- Two `cron.schedule` jobs, every minute. Each reads the app URL and
  `SQUIGGLE_SYNC_SECRET` from Supabase Vault
  (`vault.decrypted_secrets`, names `app_url` and `squiggle_sync_secret`).
  Each does nothing if either secret is missing, so local and fresh
  databases are safe.
  - `squiggle-sync`: `net.http_post` to `/api/sync/squiggle` if the last
    `squiggle_sync_runs` row is more than 55 minutes old, or a Game
    completed since the last `ladder` run. The planner decides the rest.
    This is what keeps the off-Season to a handful of calls a day.
  - `squiggle-live`: `net.http_post` to `/api/sync/live-scores` if a Game
    has `complete < 100` and starts between 6 hours ago and 30 minutes from
    now (`LIVE_POST_START_WINDOW_MS`, `LIVE_PRE_GAME_WINDOW_MS`), and the
    lease expires within 20 seconds or has expired.

**Verify**: `npx supabase db reset`. With no Vault secrets set,
`select * from cron.job_run_details` shows the jobs ran and called nothing.
Update a Game's score by hand, and a browser subscribed as in Step 2c gets
the broadcast.

### Step 11: Live scores in the browser

- `src/features/afl-tipping/api/live-scores.realtime.ts`: a
  `LiveScoresService` on `RealtimeClient` (Step 2c). It joins
  `afl:live-games` while it has subscribers, and leaves when the last one
  goes. It parses each payload with a small Zod schema into
  `LiveGameUpdate`. It calls `onResync` when the channel subscribes again
  after `CHANNEL_ERROR`, `TIMED_OUT` or `CLOSED`, and refreshes the token
  as Step 2c found.
- `getRealtimeToken` server function (D5): returns the session's access
  token and its expiry, or 401. Never the refresh token.
- The browser needs the Supabase URL and the publishable key. Both are
  already `VITE_` variables, and both are public by design.
- `router.tsx` registers the Realtime service when `VITE_LIVE_SCORES` is
  `realtime` (the default), and the old relay service when it is `relay`.
  The relay stays as a fallback until Step 13. The Demo keeps its no-op.
- `use-live-scores.ts` doesn't change. Its `onResync` now refetches from our
  database, not from Squiggle.
- Copy `live-scores.service.test.ts`'s cases to the Realtime service, with a
  fake channel.

**Verify**: `npm run test:ci`, `npm run build`. Locally, with a Game made
live by hand in `afl_games` and a sync run feeding it, two signed-in tabs get
the same update. A signed-out tab gets nothing.

### Step 12: Docs

- `docs/adr/0009-squiggle-is-read-on-a-schedule.md`: D1, D2, D6, D7, with
  the options they beat.
- `docs/adr/0010-live-scores-come-from-one-ingest-through-realtime.md`: D3,
  D4, D5. Mark ADR 0005 "Superseded by 0010" at its top, and leave the rest
  of it alone.
- ADR 0002, Consequences: add that `realtime.messages` has one `select`
  policy, for `afl:live-games` (ADR 0010), and that the lease functions
  are revoked from `anon` and `authenticated`.
- `AGENTS.md`: under "Service Registry Pattern" and "Server Functions", say
  that only `src/features/afl-tipping/sync/` calls Squiggle. Every other
  read is from our tables.
- `docs/squiggle-sync.md`, linked from `docs/README.md` ("Read it when the
  data looks stale, or Squiggle gets in touch"). Include: the request
  budget, how to read `squiggle_sync_runs`, a query for "requests in the
  last 24 hours", how to pause the jobs (`cron.unschedule`), and how to run
  a sync by hand.

### Step 13: OPERATOR — release

1. Set `SQUIGGLE_CONTACT_EMAIL` and `SQUIGGLE_SYNC_SECRET` in Vercel
   (Production). Set the Vault secrets `app_url` and `squiggle_sync_secret`
   in Supabase.
2. Apply the migrations, then deploy.
3. Run `npm run sync:squiggle` against production once to backfill. Check
   that `afl_games` has 2026 and 2027, and that the 2026 Leaderboard
   matches what it showed before.
4. Over the next day, check `squiggle_sync_runs`: a few runs, all `ok`,
   requests within budget.
5. **At the first Game of Opening Round 2027**: watch a live Game on two
   devices. Check that `squiggle_sync_runs` shows `live` runs about 5
   minutes apart, that scores arrive within seconds, and that only one
   Squiggle connection is open at a time. If it fails, set
   `VITE_LIVE_SCORES=relay` and redeploy, then report.
6. After a Round with no problems, an executor deletes
   `src/routes/api/live-scores.ts`, `sse-proxy.ts`, their tests, the relay
   service, `VITE_LIVE_SCORES` and the old `functionRules` entry, in one
   commit.

### Step 14: Update the plans index

Set this plan's row in `plans/README.md`. Plan 004's relay is replaced by
this plan. When Step 13.6 is done, mark 004 DONE as superseded by 015.

## Done criteria

- No request to `squiggle.com.au` comes from a visitor's action. Only
  `src/features/afl-tipping/sync/` imports `squiggle/api.ts`.
- The User-Agent carries a real contact email from `SQUIGGLE_CONTACT_EMAIL`.
- In-Season, `squiggle_sync_runs` shows under 100 Standard API requests a
  day, and at most one live connection at a time.
- Every page renders from our tables. With Squiggle unreachable, the app
  still shows the last good data.
- Live updates reach signed-in tabs through Realtime. Signed-out browsers
  get nothing.
- The Demo works unchanged (`npm run dev:demo`).
- `npm run check`, `npm run typecheck`, `npm run test:ci`, `npm run build` pass.

## STOP conditions

- Step 2b: a Vercel function stops when `pg_net` disconnects, and nothing
  keeps it running.
- Step 2c: Realtime can't keep signed-out browsers out, or the free plan's
  quotas are lower than the Tipster count needs.
- Squiggle's Event API answers our server with 403, or Squiggle says it
  doesn't want ~12 reconnects an hour. Tell the operator. D3's always-on
  worker is the alternative.
- Any table this plan adds would be readable with the publishable key.
- The 2026 Leaderboard changes after the backfill (Step 13.3).
- It's February 2027 and Steps 3–11 aren't done. Tell the operator. Steps
  3–8 alone already fix the Standard API traffic. The relay could stay for
  one more Season.

## Notes

- Squiggle facts used here, from `api.squiggle.com.au` (read 2026-11-25):
  - The Event API's `/events` channel covers every Game. On connect it
    sends a `game` event with the current state, then `score`, `timestr`,
    `complete`, then `winner` and a final `game`. `/test` sends random
    data. Events have `id:` lines. The docs don't mention `Last-Event-ID`.
  - "The Event API rarely but occasionally restarts … handle disconnection
    and auto-reconnection." And: "Clients that use the Event API for
    one-off data fetches will be blocked."
  - Standard API freshness (changelog 1.13.1): tips up to 30 s behind,
    games 60 s, standings 5 min, teams 1 h. "If you care about timely game
    data, use the Event API instead."
  - `q=games` and `q=tips` need `year` or `game`. `q=games` also takes
    `round`, `team`, `complete` (with `!` to negate) and `live=1`.
  - Changelog 1.13.2 (April 2026): the API refuses referred requests from
    sites that send their users' browsers to Squiggle.
  - No webhooks. The Event API is the only push.
- Vercel: the account has no teams, so it's on Hobby. Cron jobs run at
  most once a day there, which is why D2 uses `pg_cron`.
- Supabase's free plan pauses a project after a week with no activity
  (ADR 0006). The hourly sync writes to the database. Don't assume that
  counts as activity: check before relying on it.

### Step 2 findings (2026-11-25)

Each finding is marked **verified** (run here), **docs** (read from primary docs or source) or
**unverified** (needs the operator or Opening Round). No STOP condition is hit. 2b still needs
the operator's preview test before Step 7 relies on it.

#### 2a. Squiggle Event API

`SQUIGGLE_CONTACT_EMAIL` is not in the repo's `.env`, `.env.local` or `.env.example`, so the
spike could not use the real User-Agent. It used
`Hot Shots Tipping (hot-shots.dev) - https://www.hot-shots.dev` (a URL, no email). Squiggle
answered 200 to it. The operator must add the variable to `.env` before Step 4 (Step 1.2 says it
should be there). Two connections only: `/test` and `/events`, 60 s each, side by side.

- **Verified**: both channels answer 200 with `content-type: text/event-stream` and
  `cache-control: no-cache`, behind Cloudflare.
- **Verified**: the first bytes on both are `retry:2000`, then an `event:message` event with an
  `id:` line and a JSON string as data ("Hello and welcome to the event channel for ALL
  events."). So Squiggle asks clients to reconnect after 2 s.
- **Verified**: `id:` lines are on every event. They are random UUIDs, not a sequence. So there
  is nothing to resume from with `Last-Event-ID`, and the plan's reliance on the connect-time
  snapshot is right.
- **Verified**: Squiggle sends its own heartbeat, a `:` comment line every 10 s.
- **Verified, `/test`**: only `message` and `score` events, one `score` about every 10 s. A
  `score` carries `gameid`, `type` (`goal` or `behind`), `side`, `team`, `complete`, `timestr`
  and `score` (`hgoals`, `hbehinds`, `hscore`, `agoals`, `abehinds`, `ascore`). Example:
  `{"gameid":199407,"type":"goal","side":"ateam","team":3,"complete":33,"timestr":"Q4 23:42","score":{"hgoals":0,"hbehinds":5,"hscore":5,"agoals":15,"abehinds":17,"ascore":107}}`
- **Verified, `/events`, off-Season**: nothing but the welcome `message` and heartbeats. No
  `game` snapshot on connect when no Game is live. Whether a `game` event arrives per live Game
  on connect is **unverified**, and so are the shapes of `game`, `timestr`, `complete` and
  `winner`. Opening Round is the first chance (the `TODO(sse-pin)` stays).
- **Reasoned from the code**: `parseSseEvent` handles `score` (the only Game event seen): it
  reads `hscore` and `ascore` from the nested `score` object, and `complete` and `timestr` from
  the top level. It returns `null` for `message`, so the welcome is ignored. Nothing seen is
  unhandled. The ingest's SSE parser must also skip `:` comment lines and `retry:`.
- **Supports D3**: a server-to-server connection with no Origin header was accepted, and
  Squiggle itself asks for 2 s reconnects.

#### 2b. Vercel `waitUntil` and `pg_net`

Nothing was deployed. Installed: `nitro@3.0.260903-beta`. `@vercel/functions` is **not**
installed.

- **Docs**: `waitUntil(promise)` from `@vercel/functions` "extends the lifetime of the request
  handler for the lifetime of the given Promise". "Promises passed to `waitUntil()` will have
  the same timeout as the function itself. If the function times out, the promises will be
  cancelled." It works on Node. `getDeadline()` returns the time Vercel will kill the
  invocation, `waitUntil` work included. It suits `runLiveIngest({ deadline })`.
- **Source** (`nitro/dist/presets/vercel/runtime/vercel.web.mjs`): Nitro sets
  `req.waitUntil = context.waitUntil`. Whether the `request` a TanStack Start server route gets
  is that same object is **unverified**. `import { waitUntil } from "@vercel/functions"` doesn't
  depend on it. Use that.
- **Source** (`_presets.mjs`, `generateFunctionFiles`): each `vercel.functionRules` key becomes
  its own function directory, with the rule merged over the base config, and a build route
  sending that path to it. So `maxDuration: 300` applies to the route by path. Nitro's docs show
  only `maxDuration` examples and say nothing on `waitUntil`. That a `waitUntil` task is held to
  that function's `maxDuration` is **unverified**: the preview test checks it.
- **Docs**: a TanStack Start server route is
  `createFileRoute(path)({ server: { handlers: { POST: async ({ request }) => Response } } })`,
  as `src/routes/api/live-scores.ts` already does. Its docs don't mention `waitUntil`.
- **Unverified, the point of the spike**: that the function runs on after `pg_net` stops waiting
  at 5 s. The 202 goes out at once and `waitUntil` keeps the function alive, so it should. The
  test below proves it.

**Operator procedure (throwaway branch, never merge it)**

1. `git switch -c spike/wait-until main`, then `npm i @vercel/functions`.
2. Add `src/routes/api/spike-wait.ts`:

   ```ts
   import { createFileRoute } from "@tanstack/react-router";
   import { waitUntil } from "@vercel/functions";

   const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

   export const Route = createFileRoute("/api/spike-wait")({
     server: {
       handlers: {
         POST: async ({ request }) => {
           if (request.headers.get("authorization") !== "Bearer spike") {
             return new Response("no", { status: 401 });
           }
           const id = crypto.randomUUID().slice(0, 8);
           waitUntil(
             (async () => {
               const t0 = Date.now();
               for (let i = 0; i < 9; i++) {
                 console.log(`[spike ${id}] alive at ${Math.round((Date.now() - t0) / 1000)}s`);
                 await sleep(30_000);
               }
               console.log(`[spike ${id}] finished at ${Math.round((Date.now() - t0) / 1000)}s`);
             })(),
           );
           console.log(`[spike ${id}] returning 202`);
           return new Response(null, { status: 202 });
         },
       },
     },
   });
   ```

3. In `vite.config.ts`, add `"/api/spike-wait": { maxDuration: 300 }` to `functionRules`.
4. Push the branch. Vercel builds a preview. If Deployment Protection is on, create a
   Protection Bypass for Automation secret in the project settings and send it as the header
   `x-vercel-protection-bypass`.
5. In the Supabase SQL editor:

   ```sql
   select net.http_post(
     url := 'https://<preview-host>/api/spike-wait',
     headers := jsonb_build_object(
       'Authorization', 'Bearer spike',
       'x-vercel-protection-bypass', '<bypass secret, if protection is on>'
     ),
     body := '{}'::jsonb,
     timeout_milliseconds := 5000
   );
   ```

   Then run
   `select status_code, timed_out, error_msg, created from net._http_response order by created desc limit 3;`.
   Expect `status_code = 202` and `timed_out = false`. A `timed_out = true` means the route
   took over 5 s to answer: fix that first.

6. In the Vercel project's Logs, filter on `spike`. **Pass**: `returning 202`, then
   `alive at 0s`, `30s` … `240s`, then `finished at 270s`, with no timeout line. **Fail**: the
   lines stop soon after `returning 202`, or a timeout appears. Then try once more without
   step 3, to see the base limit.
7. Delete the branch and the preview.

If it fails, the 2b STOP condition holds: D3 needs the always-on worker or Vercel Pro.

#### 2c. Realtime from a signed-in client

This project's local Supabase (`supabase_*_hot_shots`, ports 553xx) was already running. Another
project's (`clover-studio`, ports 543xx) runs beside it and was not touched. The spike made a
throwaway table, trigger, policy and test user in the local database, ran a Node script on
`@supabase/realtime-js` 2.119.2 (`RealtimeClient`), then dropped them all. The repo is
unchanged.

- **Verified**: a trigger calling `realtime.send(payload, 'live-game', 'afl:live-games', true)`
  and a `select` policy `to authenticated using (realtime.topic() = 'afl:live-games')` deliver
  each row update to a client that did `setAuth(<user access token>)` and joined
  `channel('afl:live-games', { config: { private: true } })`. The payload arrived intact
  (`gameId`, `homeScore`, `awayScore`, `timeStr`, `complete`, `winnerTeamId`) with an extra `id`.
- **Verified**: signed-out clients are refused. With only the anon key, or only the publishable
  key, the channel goes to `CHANNEL_ERROR` ("Unauthorized: You do not have permissions to read
  from this Channel topic") and receives nothing. realtime-js keeps retrying the join every few
  seconds, so the service should `removeChannel` on `CHANNEL_ERROR` when it has no valid token.
  The 2c STOP condition (signed-out browsers kept out) is not hit.
- **Verified**: a signed-in client can't send. `channel.send(...)` on the topic returns `"ok"`
  (an ack, not a delivery), but a second signed-in listener got nothing. With no `insert` policy
  the message is dropped without an error. Don't treat `"ok"` as proof of anything.
- **Verified, token expiry**, with a JWT that expires in 8 to 12 s, minted with the local JWT
  secret:
  - At expiry the server closes the channel: status `CLOSED`, and updates stop. The socket stays
    open.
  - `setAuth(newToken)` **after** that does not bring the channel back. It stays closed.
  - `setAuth(newToken)` **before** expiry keeps the same channel `joined`, and updates keep
    arriving past the old expiry.
  - After expiry, `removeChannel(channel)` and a fresh `channel(...)` join works once the new
    token is set.
  - So Step 11: call `getRealtimeToken` again about 5 minutes before `expiresAt`, and `setAuth`
    the new token. On `CLOSED` or `CHANNEL_ERROR`, fetch a token, `setAuth`, remove the channel,
    join a new one and call `onResync`. A tab that slept through expiry takes the second path.
- **Docs, free plan Realtime quotas** (`supabase.com/docs/guides/realtime/limits`, read today):
  200 concurrent connections, 100 messages per second, 100 channel joins per second, 100
  channels per connection, broadcast payload 256 KB. Pro: 500 connections, 500 messages per
  second. The page lists no monthly message cap. Each open tab is one connection, so 200 tabs
  at once is the ceiling. A few messages a second at most, each under 1 KB, is far under the
  rate limit.
- **Docs**: `realtime.send(..., private)` defaults to `true`, and a private database broadcast
  reaches only private channels, so the client must set `config.private: true`. Supabase's own
  example policy is `for select to authenticated using (true)`; ours is stricter.
- **Unverified**: the browser build of realtime-js (the spike ran in Node); that the access
  token `getClaims()` leaves in the session works the same as the password-grant token used here
  (both are ordinary Supabase JWTs); hosted Supabase's Realtime version, which may differ from
  local. On the hosted project, check that "Allow public access" is off in the Realtime
  settings, so only private channels exist.

#### Verdict on the design

- D3: 2a supports it. 2b is the open one: the operator runs the preview test before Step 7.
- D4: supported by the local test. The polling fallback isn't needed.
- D5: supported. Signed-out browsers can't receive, and nobody can send. Add the expiry handling
  above to Step 11.

### Step 4 executor notes (2026-11-25)

- The client is `createSquiggleClient({ budget })` in `squiggle/api.ts`: `fetchGames({ year, round?,
  complete? })`, `fetchGame(id)`, `fetchModelTips({ year, round })`, `fetchLadder(year)`,
  `fetchTeams()` and `requestCount()`. The User-Agent comes from `buildSquiggleUserAgent` in
  `squiggle/user-agent.ts`, read from `process.env.SQUIGGLE_CONTACT_EMAIL` on every request.
- `SQUIGGLE_USER_AGENT` is gone. Two other users needed the same email: `sse-proxy.ts` now answers
  503 without it (the relay goes in Step 13), and `scripts/snapshot-demo-season.ts` throws.
- `squiggle.serverfns.ts` keeps working through `unwrapSquiggle`, which throws at the server-function
  boundary. Step 8 deletes that code.
- Not done, as asked: `AflStanding` and `getStandings` still say "standings" while GLOSSARY.md says
  Ladder. Worth a separate rename after this plan.
