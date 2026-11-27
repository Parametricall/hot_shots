# Squiggle sync

Squiggle's data reaches the site through two server-side jobs, never through a visitor
(`docs/adr/0009`, `docs/adr/0010`). Read this when the data looks stale, or Squiggle gets in touch.

- **Squiggle sync**: `POST /api/sync/squiggle`, called by `pg_cron` every 10 minutes. It asks
  Squiggle's Standard API only for what is due, and upserts Games, Teams, Model tips and the Ladder.
  A tick with nothing due sends nothing and records no run.
- **Live ingest**: `POST /api/sync/live-scores`, called by `pg_cron` every minute while a Game is
  live or starts within 30 minutes, unless a run holds the lease. One run holds one Event API
  connection for about 5 minutes and writes live scores to `afl_games`.

Both endpoints answer `405` to anything but `POST`, `401` to a wrong bearer token and `503` if
`SQUIGGLE_SYNC_SECRET` isn't set. They answer `202` at once and work on in the background.

## Request budget

| Data         | When it's fetched                                                                                                  | Squiggle query                                   | Requests a day               |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------- |
| Fixture      | Hourly in-Season, Games not yet complete only. Daily full reconcile. Daily off-Season. A Season that's over: never | `q=games;year=Y;complete=!100`, `q=games;year=Y` | up to 25                     |
| Next Fixture | Daily, until Squiggle has Games for next year                                                                      | `q=games;year=Y+1`                               | 1                            |
| Model tips   | Hourly for the Round(s) with a Game starting in the next 7 days. Daily otherwise                                   | `q=tips;year=Y;round=R;source=1`                 | up to 48                     |
| Ladder       | 10 minutes after a Game completes (Squiggle delays standings by up to 5). Daily reconcile in-Season                | `q=standings;year=Y`                             | up to 10                     |
| Teams        | Weekly, or when a Game names a team we don't have (at most hourly)                                                 | `q=teams`                                        | under 1                      |
| Live         | One connection while any Game is live or starts within 30 minutes                                                  | `sse.squiggle.com.au/events`                     | about 12 connections an hour |

That is under 100 Standard API requests a day in-Season, whatever the number of Tipsters. The
guardrails: at most 10 requests a run and 300 a day (Melbourne time), and after a failure a job
backs off 1, 2, 4 ... up to 60 minutes. The constants are at the top of
`src/features/afl-tipping/sync/plan-squiggle-sync.ts`. A Season is closed, and never refetched,
once every Game is complete and it was fetched in full at least 4 hours after its last Game started.

A Game whose live fields were written in the last 10 minutes keeps them when the sync upserts it,
so a sync can't put an older score over a live one.

## Settings

| Where                       | Name                     | What it is                                                                                                                 |
| --------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Vercel (Production), `.env` | `SQUIGGLE_CONTACT_EMAIL` | The contact address in the User-Agent. Server-only. Never put it in the repo: it is public. Nothing runs without it        |
| Vercel (Production), `.env` | `SQUIGGLE_SYNC_SECRET`   | The bearer token the endpoints expect. Server-only: never give it a `VITE_` prefix                                         |
| Supabase Vault              | `app_url`                | `https://www.hot-shots.dev`: where the cron jobs post. No trailing slash                                                   |
| Supabase Vault              | `squiggle_sync_secret`   | The same value as `SQUIGGLE_SYNC_SECRET`. If the two differ, every call gets `401` and nothing syncs                       |
| Vercel (build time), `.env` | `VITE_LIVE_SCORES`       | Empty or `realtime`: live scores over Supabase Realtime. `relay`: the old per-tab proxy, until plan 015 Step 13 deletes it |

Until both Vault secrets exist the cron jobs do nothing, so a local or new database is safe. Set
them in the Supabase SQL editor, once per environment:

```sql
select vault.create_secret('https://www.hot-shots.dev', 'app_url');
select vault.create_secret('<the same value as SQUIGGLE_SYNC_SECRET>', 'squiggle_sync_secret');
```

To change one, use `vault.update_secret(<id from vault.secrets>, '<new value>')`.

## Read `squiggle_sync_runs`

One row per job run. In the SQL editor:

```sql
select job, started_at, finished_at, ok, reason, detail, requests
from squiggle_sync_runs
order by started_at desc
limit 30;
```

- `job` is `fixture`, `model-tips`, `ladder`, `teams` or `live`.
- `ok` is true, false, or null while a run is still going.
- `reason` is a short kebab-case code on failure (`http-429`, `http-403`, `network`, `parse`, `budget`).
  `detail` is the error's message.
- `requests` is Standard API requests for the four sync jobs, and Event API connections for `live`.

Healthy: `ok` rows, with no job failing over and over. A job that keeps failing backs itself off, so
its rows get further apart. A `fixture` row with `reason` `parse` means Squiggle's response changed
shape: nothing was written, and the last good data is still showing.

Standard API requests in the last 24 hours (the budget is 300 a day):

```sql
select coalesce(sum(requests), 0) as requests_24h
from squiggle_sync_runs
where job <> 'live' and started_at > now() - interval '24 hours';
```

Live connections in the last 24 hours:

```sql
select count(*) as live_runs, coalesce(sum(requests), 0) as connections
from squiggle_sync_runs
where job = 'live' and started_at > now() - interval '24 hours';
```

Failures in the last day:

```sql
select job, reason, count(*) from squiggle_sync_runs
where ok = false and started_at > now() - interval '24 hours'
group by job, reason;
```

## Is the live ingest running

During a Game, `live` runs should start about 5 minutes apart, and the lease should be taken:

```sql
select holder, expires_at, expires_at > now() as held from squiggle_live_lease;
select started_at, finished_at, ok, reason, requests
from squiggle_sync_runs where job = 'live' order by started_at desc limit 5;
```

- `held` true with a recent `live` run: it is running. Only one run can hold the lease.
- No Game live or within 30 minutes of starting: no runs, and `holder` is null. That is normal.
- A Game is on but nothing is running: check the `cron.job_run_details` below, then the Vault
  secrets. A run that died leaves the lease to expire by itself within 295 seconds.
- A `live` run with `requests` 0 found no live Game when it started.

Check that the cron jobs are running:

```sql
select jobname, schedule, active from cron.job;
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j using (jobid)
order by d.start_time desc limit 10;
select status_code, timed_out, error_msg, created
from net._http_response order by created desc limit 10;
```

`status_code` 202 is a started job. 401 means the secrets differ, 503 that `SQUIGGLE_SYNC_SECRET`
isn't set in Vercel, and `timed_out` that the endpoint took over 5 seconds to answer.

A third job, `prune-squiggle-job-history`, runs weekly (Tuesday 17:00 UTC). It deletes
`cron.job_run_details` rows older than 7 days and `squiggle_sync_runs` rows older than 90 days, so
neither grows for ever on the free database. Look further back than that and the rows are gone.

## Pause and resume

Pause both jobs, for example if Squiggle asks us to stop:

```sql
select cron.unschedule('squiggle-sync');
select cron.unschedule('squiggle-live');
```

Resume by running the `cron.schedule` lines at the end of
[`supabase/migrations/20261125110000_squiggle_live_and_schedule.sql`](../supabase/migrations/20261125110000_squiggle_live_and_schedule.sql).
A job name replaces any job of that name, so running them twice is safe.

A Supabase project the free plan has paused runs no jobs: resume the project first.

## Run a sync by hand

```bash
npm run sync:squiggle              # the local Supabase
```

It reads `.env`, plans what is due and sends only that. Run again at once, it sends few or no
requests. It prints the number of requests and each job's outcome, never the keys or the email.

```bash
npm run sync:squiggle -- --remote  # any Supabase that isn't local
```

The script refuses a non-local Supabase without `--remote`. Use it for the first backfill of
production (it sends a real run's worth of requests to Squiggle), not as a way to refresh data
that looks stale: fix the schedule instead, or Squiggle sees extra traffic. The run is recorded in
`squiggle_sync_runs` like any other.

## Local development

- **Live scores locally.** `.env.local` (pulled by the Vercel CLI) points `VITE_SUPABASE_URL` at
  the hosted project, and overrides `.env`, so `npm run dev` makes the browser join hosted
  Realtime. To test against the local stack:

  ```bash
  VITE_SUPABASE_URL=http://127.0.0.1:55321 npm run dev
  ```

  Then change a Game's live fields by hand in the local `afl_games`: a signed-in tab gets the
  update, and a signed-out tab gets nothing. Make a test user with `npm run seed:dev-users`.

- **Cron jobs locally** do nothing, because the Vault secrets aren't set. Run
  `npm run sync:squiggle` instead, with `SQUIGGLE_CONTACT_EMAIL` in `.env`.
- **The hosted Realtime setting "Allow public access" must be off**, so only private channels
  exist. Local Supabase can't show it.
