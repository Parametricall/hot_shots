-- When the sync last asked Squiggle for a whole year's Fixture, and whether it had any Games
-- (plan 015). A year with no Games has no afl_games row to carry a synced_at, so without this the
-- daily "does next year's Fixture exist yet?" check could not tell when it last ran. RLS is on
-- with no policies, like every table (docs/adr/0002): only the sync, with the secret key, uses it.
create table public.squiggle_fixture_checks (
  season integer primary key,
  checked_at timestamptz not null,
  had_games boolean not null
);
alter table public.squiggle_fixture_checks enable row level security;
