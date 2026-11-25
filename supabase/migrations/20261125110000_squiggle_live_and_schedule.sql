-- Live scores and the schedule (plan 015, docs/adr/0010 (Step 12)). Three parts:
--
-- 1. A trigger on afl_games broadcasts a live change over Supabase Realtime.
-- 2. A policy lets signed-in browsers receive that broadcast and nothing else. This is the
--    exception docs/adr/0002 allows ("explicit policies for exactly that table and operation");
--    the secret key still never leaves the server.
-- 3. pg_cron calls our own endpoints through pg_net, with a shared secret read from Vault. Both
--    jobs do nothing until the Vault secrets `app_url` and `squiggle_sync_secret` exist, so local
--    and fresh databases are safe. Set them with vault.create_secret(...) per environment.

-- 1. Broadcast ---------------------------------------------------------------------------------

-- Security invoker, on purpose: the spike (plan 015 Step 2c) showed the role that updates the
-- Game (the secret key's service_role) can call realtime.send, so the function needs no extra
-- privilege. The search_path is fixed, so every name below is schema-qualified. Nobody needs to
-- call it directly, so execute is revoked: PostgREST exposes this schema, and Postgres lets
-- PUBLIC execute new functions. A trigger still fires without the caller holding execute.
create function public.broadcast_afl_game_live_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.home_score is distinct from old.home_score
    or new.away_score is distinct from old.away_score
    or new.time_str is distinct from old.time_str
    or new.complete is distinct from old.complete
    or new.winner_team_id is distinct from old.winner_team_id
  then
    -- The payload's names match LiveGameUpdate in sse-schemas.ts. The last argument makes the
    -- message private, so only private channels (and so the policy below) receive it.
    perform realtime.send(
      jsonb_build_object(
        'gameId', new.id,
        'homeScore', new.home_score,
        'awayScore', new.away_score,
        'timeStr', new.time_str,
        'complete', new.complete,
        'winnerTeamId', new.winner_team_id
      ),
      'live-game',
      'afl:live-games',
      true
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.broadcast_afl_game_live_update() from public, anon, authenticated;

create trigger afl_games_broadcast_live_update
after update on public.afl_games
for each row execute function public.broadcast_afl_game_live_update();

-- 2. Who may receive it -------------------------------------------------------------------------

-- Select only, on one topic. There is no insert policy, so no browser can send.
create policy "signed-in users receive live scores"
on realtime.messages
for select
to authenticated
using (realtime.topic() = 'afl:live-games' and realtime.messages.extension = 'broadcast');

-- 3. The schedule -------------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Posts to one of our endpoints, or does nothing if the Vault secrets aren't set. Runs as the
-- role that owns the cron job (postgres), which can read Vault. Security invoker, fixed
-- search_path, and not callable by the API roles.
create function public.squiggle_post(path text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'squiggle_sync_secret';
  if url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := url || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

-- Every 10 minutes, with no condition: the planner decides what is due and records no run for a
-- tick with nothing planned, so most ticks send no request to Squiggle.
create function public.squiggle_sync_tick()
returns void
language sql
set search_path = ''
as $$
  select public.squiggle_post('/api/sync/squiggle');
$$;

-- Every minute, only while a Game is live or about to start (LIVE_PRE_GAME_WINDOW_MS,
-- LIVE_POST_START_WINDOW_MS) and no live ingest holds the lease for more than another 20 seconds.
-- The ingest holds it for 295 s, so the tick in the last 20 s of a run starts the next run, and
-- an ingest that finds the lease still held does nothing.
create function public.squiggle_live_tick()
returns void
language sql
set search_path = ''
as $$
  select public.squiggle_post('/api/sync/live-scores')
  where exists (
    select 1
    from public.afl_games
    where complete < 100
      and start_time between now() - interval '6 hours' and now() + interval '30 minutes'
  )
  and exists (
    select 1
    from public.squiggle_live_lease
    where id = 1 and (holder is null or expires_at <= now() + interval '20 seconds')
  );
$$;

revoke execute on function public.squiggle_post(text) from public, anon, authenticated;
revoke execute on function public.squiggle_sync_tick() from public, anon, authenticated;
revoke execute on function public.squiggle_live_tick() from public, anon, authenticated;

-- cron.schedule with a job name replaces a job of that name, so re-running this is safe.
select cron.schedule('squiggle-sync', '*/10 * * * *', 'select public.squiggle_sync_tick()');
select cron.schedule('squiggle-live', '* * * * *', 'select public.squiggle_live_tick()');
