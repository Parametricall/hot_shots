-- Seasons (docs/adr/0007). A Tipster enters each Season's Competition by opening AFL Tipping
-- during it, and every Tip belongs to the Season it was made in. RLS is on with no policies,
-- like every table (docs/adr/0002): the app reads these with the secret key.

-- One Season's Competition per row. Auto-tips start at entered_at (docs/adr/0001).
create table public.afl_competition_entries (
  profile_id uuid not null references public.afl_tipsters (profile_id) on delete cascade,
  season integer not null,
  entered_at timestamptz not null default now(),
  primary key (profile_id, season)
);
alter table public.afl_competition_entries enable row level security;

-- Everyone who joined before now entered 2026 when they joined, so 2026 scores don't move.
insert into public.afl_competition_entries (profile_id, season, entered_at)
select profile_id, 2026, joined_at from public.afl_tipsters;

-- The app first went live in 2026, so every Tip so far is a 2026 Tip. This can't check the Game
-- ids (Squiggle holds the Fixture), only that no Tip was made outside 2026.
do $$
begin
  if exists (
    select 1 from public.afl_tipping
    where created_at < '2026-01-01' or created_at >= '2027-01-01'
  ) then
    raise exception 'afl_tipping has Tips made outside 2026';
  end if;
end $$;

alter table public.afl_tipping add column season integer;
update public.afl_tipping set season = 2026;
alter table public.afl_tipping
  alter column season set not null,
  add constraint afl_tipping_entry_fkey
    foreign key (user_id, season)
    references public.afl_competition_entries (profile_id, season) on delete cascade;
create index afl_tipping_season_idx on public.afl_tipping (season);
