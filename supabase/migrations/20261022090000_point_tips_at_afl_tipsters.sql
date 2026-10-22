-- Clerk ids become Profile ids (docs/adr/0006). Runs once, after
-- scripts/migrate-clerk-users.ts has filled profiles.clerk_user_id.
update afl_tipping
set user_id = profiles.id::text
from profiles
where afl_tipping.user_id = profiles.clerk_user_id;

do $$
begin
  if exists (
    select 1 from afl_tipping
    where not exists (
      select 1 from afl_tipsters
      where afl_tipsters.profile_id::text = afl_tipping.user_id
    )
  ) then
    raise exception 'afl_tipping has Tips from people with no afl_tipsters row';
  end if;
end $$;

-- Production still has Clerk's `auth.jwt() ->> 'sub'` default, which can't be cast to uuid.
-- The server always sets user_id, so drop it.
alter table afl_tipping
  alter column user_id drop default,
  alter column user_id type uuid using user_id::uuid,
  add constraint afl_tipping_user_id_fkey
    foreign key (user_id) references afl_tipsters (profile_id) on delete cascade;
