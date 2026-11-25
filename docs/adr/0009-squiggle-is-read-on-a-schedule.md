# Squiggle is read on a schedule by one sync, and every visitor is served from our own tables

Squiggle's terms ask us to identify ourselves, cache and re-use data, fetch no more than we need,
and keep the bot from spinning out of control. They say its API is "not a free production database
backend for third-party user-facing sites". Our server used to pass every visitor request straight
through, so Squiggle traffic grew with every visitor, tab and refocus: one visit to My Tips made
about four identical full-Season fetches.

Now **no visitor action causes a Squiggle request.** A sync (`src/features/afl-tipping/sync/`)
reads Squiggle on a schedule and upserts Games, Teams, Model tips and the Ladder into `afl_*`
tables. Every other read, in a server function or the browser, comes from those tables, through
`squiggleDataRepository`. Only the sync and the live ingest (`docs/adr/0010`) call Squiggle.

Supabase's `pg_cron` calls the sync every 10 minutes, through `pg_net`, with a shared secret
(`SQUIGGLE_SYNC_SECRET`, read from Supabase Vault). The endpoint is `POST /api/sync/squiggle`. A
pure planner (`planSquiggleSync`) reads what the tables hold and the last runs, and works out which
jobs are due. A tick with nothing due sends nothing to Squiggle and records no run.

The User-Agent's contact email comes from `SQUIGGLE_CONTACT_EMAIL`, a server-only variable, never
the repo, which is public. The sync refuses to run without it.

Every run is recorded in `squiggle_sync_runs`. Four guardrails stop the bot spinning out of
control:

- A run sends at most 10 requests, and a day (Melbourne time) at most 300.
- After a failure a job backs off 1, 2, 4 ... minutes, up to 60.
- A response that fails its Zod schema writes nothing, and the job backs off as if Squiggle had
  failed. The last good data stays.
- A Game whose live fields the live ingest wrote in the last 10 minutes keeps them: the sync
  upserts that Game without its score, clock, `complete` and winner.

## Considered options

| Option                                                                  | Why not                                                                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A shared cache in front of the pass-through (Runtime Cache, `s-maxage`) | Cuts traffic a lot, but it still grows with users, every cache miss is a visitor waiting on Squiggle, and a Squiggle outage is our outage             |
| Vercel Cron                                                             | Vercel Hobby runs a cron job once a day at most, too rare for live Games. Pro runs every minute and would be a fine swap: the endpoints stay the same |
| GitHub Actions `schedule`                                               | Runs are often delayed 10 to 30 minutes                                                                                                               |
| A Supabase Edge Function doing the work                                 | It is Deno: a second codebase that can't share our Zod schemas, and the free plan caps a run at 150 seconds                                           |
| `pg_cron` and `pg_net` calling our own endpoints                        | Chosen: both extensions are on the free plan, the work stays in our codebase, and the planner decides what is due                                     |

## Consequences

- **The request budget, as built**, in-Season: Fixture (the Games not yet complete) at most hourly,
  and a full reconcile daily; next year's Fixture daily until Squiggle has Games for it; Model tips
  hourly for the Round or Rounds with a Game starting in the next 7 days, daily otherwise; the
  Ladder 10 minutes after a Game completes (Squiggle delays standings by up to 5), and a daily
  reconcile; Teams weekly, or at once, but at most hourly, when a Game names a team we don't have.
  That is under 100 Standard API requests a day, whatever the number of Tipsters. Off-Season it is
  a handful. `docs/squiggle-sync.md` has the table.
- **A closed Season is never refetched.** A Season is closed once every Game is complete and it was
  fetched in full at least 4 hours after its last Game started.
- **A Squiggle outage is stale data, not an outage.** Visitors read our tables, so the site keeps
  working with the last good data. The sync backs off while Squiggle is down.
- **The live-data rule.** Squiggle's Standard API Games are up to 60 seconds behind its Event API.
  Without the 10-minute protection, a sync landing mid-Game could overwrite a fresher live score
  with an older one.
- **`pg_cron` runs every 10 minutes, so a due job waits up to 10 minutes** for its tick.
- **A Supabase project pause stops the schedule.** The free plan pauses a project after a week
  with no activity (`docs/adr/0006`); a paused project runs no `pg_cron` job, and the data goes
  stale until someone resumes it. Whether the sync's own writes count as activity isn't checked.
- **The first fill is a manual run.** `npm run sync:squiggle -- --remote` backfills production
  once, before the schedule has anything to plan from.
- **The secrets are in two places.** `SQUIGGLE_SYNC_SECRET` is a Vercel variable and Vault's
  `squiggle_sync_secret`; the app URL is Vault's `app_url`. If they differ, the endpoint answers 401
  and nothing syncs. `docs/squiggle-sync.md` says how to check.
- **`squiggle_sync_runs` is the monitor.** There is no alerting; someone has to look at it.
