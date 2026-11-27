-- Prune the schedule's history (plan 015, docs/adr/0009). pg_cron writes a row to
-- cron.job_run_details for every run and never deletes one. squiggle-live checks every minute all
-- year, so that's ~45,000 rows a month on a free database with a size cap. squiggle_sync_runs grows
-- too, more slowly. Nothing reads either table further back than this keeps:
--
-- - cron.job_run_details is for "are the jobs running?" (docs/squiggle-sync.md): a week is enough.
-- - The sync planner reads only today's request count and the newest 200 runs of
--   squiggle_sync_runs, so 90 days keeps it working and leaves a Season's worth to look back on.
--
-- Security invoker with a fixed search_path, like the other schedule functions. pg_cron runs it as
-- the job's owner (postgres). Execute is revoked from the API roles: PostgREST exposes this schema,
-- and Postgres lets PUBLIC execute new functions.
create function public.prune_squiggle_job_history()
returns void
language sql
set search_path = ''
as $$
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from public.squiggle_sync_runs where started_at < now() - interval '90 days';
$$;

revoke execute on function public.prune_squiggle_job_history() from public, anon, authenticated;

-- Weekly, Tuesday 17:00 UTC: Wednesday early morning in Melbourne, when no Game is on.
-- cron.schedule with a job name replaces a job of that name, so re-running this is safe.
select cron.schedule(
  'prune-squiggle-job-history',
  '0 17 * * 2',
  'select public.prune_squiggle_job_history()'
);
