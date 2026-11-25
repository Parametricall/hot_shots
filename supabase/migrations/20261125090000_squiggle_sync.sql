-- Our own copy of Squiggle's data (plan 015). A scheduled sync and the live ingest write these
-- tables; every read comes from them, so no visitor causes a Squiggle request. RLS is on with no
-- policies, like every table (docs/adr/0002): the app reads and writes them with the secret key.
-- The broadcast trigger, the Realtime policy and the cron jobs come in a later migration.

-- Squiggle's teams. Refreshed weekly, or when a Game names a team we don't have.
create table public.afl_teams (
  id integer primary key,
  name text not null,
  abbrev text not null,
  logo text not null,
  debut integer not null,
  synced_at timestamptz not null default now()
);
alter table public.afl_teams enable row level security;

-- Every Game of every Season. The id is Squiggle's and is unique across Seasons. Team ids are
-- null until the AFL names the teams. The live ingest sets live_updated_at, so the Fixture sync
-- can leave fresher live fields alone.
create table public.afl_games (
  id integer primary key,
  season integer not null,
  round integer not null,
  round_name text not null,
  venue_name text not null,
  venue_city text,
  venue_state text,
  start_time timestamptz not null,
  home_team_id integer,
  away_team_id integer,
  home_score integer,
  away_score integer,
  winner_team_id integer,
  complete integer not null default 0 check (complete between 0 and 100),
  time_str text not null default 'Not Started',
  is_finals boolean not null default false,
  is_grand_final boolean not null default false,
  squiggle_updated timestamptz,
  live_updated_at timestamptz,
  synced_at timestamptz not null default now()
);
alter table public.afl_games enable row level security;
create index afl_games_season_round_idx on public.afl_games (season, round);
create index afl_games_start_time_idx on public.afl_games (start_time);

-- The Model's tip for a Game. Only the Model (Squiggle's source 1), so no source column.
-- Confidence is a percentage, and Squiggle sends it as a decimal string.
create table public.afl_model_tips (
  game_id integer primary key references public.afl_games (id) on delete cascade,
  season integer not null,
  round integer not null,
  tip_team_id integer,
  confidence numeric(5, 2) check (confidence between 0 and 100),
  home_confidence numeric(5, 2) check (home_confidence between 0 and 100),
  away_confidence numeric(5, 2) check (away_confidence between 0 and 100),
  synced_at timestamptz not null default now()
);
alter table public.afl_model_tips enable row level security;
create index afl_model_tips_season_round_idx on public.afl_model_tips (season, round);

-- The latest Ladder of each Season, overwritten on each sync.
create table public.afl_ladder (
  season integer not null,
  team_id integer not null,
  name text not null,
  rank integer not null,
  played integer not null,
  wins integer not null,
  losses integer not null,
  draws integer not null,
  points integer not null,
  goals_for integer not null,
  goals_against integer not null,
  behinds_for integer not null,
  behinds_against integer not null,
  points_for integer not null,
  points_against integer not null,
  percentage numeric not null,
  synced_at timestamptz not null default now(),
  primary key (season, team_id)
);
alter table public.afl_ladder enable row level security;

-- One row per job run, for backoff, the day's request budget and checking health by hand.
create table public.squiggle_sync_runs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('fixture', 'model-tips', 'ladder', 'teams', 'live')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  reason text,
  detail text,
  requests integer not null default 0 check (requests >= 0)
);
alter table public.squiggle_sync_runs enable row level security;
create index squiggle_sync_runs_job_started_idx on public.squiggle_sync_runs (job, started_at desc);

-- Who holds the one live Event API connection. A single row, so two ingests can't both connect.
create table public.squiggle_live_lease (
  id integer primary key check (id = 1),
  holder uuid,
  expires_at timestamptz not null default '-infinity'
);
alter table public.squiggle_live_lease enable row level security;
insert into public.squiggle_live_lease (id) values (1);

-- Takes the lease for `seconds` unless someone else holds it. Returns whether it's ours.
-- Taking it again as the same holder extends it.
create function public.acquire_squiggle_live_lease(holder uuid, seconds integer)
returns boolean
language sql
as $$
  with taken as (
    update public.squiggle_live_lease
    set holder = acquire_squiggle_live_lease.holder,
        expires_at = now() + make_interval(secs => acquire_squiggle_live_lease.seconds)
    where id = 1
      and (
        squiggle_live_lease.holder = acquire_squiggle_live_lease.holder
        or squiggle_live_lease.holder is null
        or squiggle_live_lease.expires_at <= now()
      )
    returning 1
  )
  select exists (select 1 from taken);
$$;

-- Gives the lease up at once, if it's still ours.
create function public.release_squiggle_live_lease(holder uuid)
returns void
language sql
as $$
  update public.squiggle_live_lease
  set holder = null, expires_at = '-infinity'
  where id = 1 and squiggle_live_lease.holder = release_squiggle_live_lease.holder;
$$;

-- Postgres lets PUBLIC execute new functions and PostgREST exposes this schema, so without this
-- anyone with the publishable key could take the lease.
revoke execute on function public.acquire_squiggle_live_lease(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.release_squiggle_live_lease(uuid)
  from public, anon, authenticated;
grant execute on function public.acquire_squiggle_live_lease(uuid, integer) to service_role;
grant execute on function public.release_squiggle_live_lease(uuid) to service_role;
