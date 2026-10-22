-- docs/adr/0006. RLS is on with no policies for anon or authenticated, like
-- every table (docs/adr/0002); the app reads these with the secret key.

-- A person on the site. Created by the trigger below on first sign-in.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  -- Set only for people migrated from Clerk. Dropped once Clerk is removed.
  clerk_user_id text unique
);
alter table public.profiles enable row level security;

-- An email address allowed to join the site. Deleting a row stops the
-- address joining; it doesn't remove anyone who already has.
create table public.invitations (
  email text primary key check (email = lower(email)),
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.invitations enable row level security;

-- A Profile who has joined AFL Tipping. joined_at is when Auto-tips start
-- (docs/adr/0001). Migrated Tipsters keep their Clerk sign-up date.
create table public.afl_tipsters (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now()
);
alter table public.afl_tipsters enable row level security;

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Unknown'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  update public.invitations
  set accepted_at = now()
  where email = lower(new.email) and accepted_at is null;
  return new;
end;
$$;
revoke execute on function public.create_profile_for_new_user() from anon, authenticated, public;

create trigger create_profile_after_sign_up
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- Supabase Auth calls this before creating any account, from any provider.
-- Returning an error turns the sign-in away.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.invitations
    where email = lower(event -> 'user' ->> 'email')
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('message', 'not-invited', 'http_code', 403)
  );
end;
$$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from anon, authenticated, public;
grant select on table public.invitations to supabase_auth_admin;
-- The only policy in the database, and only for the Auth server's own role:
-- anon and authenticated still get nothing (docs/adr/0002).
create policy "Supabase Auth reads invitations"
  on public.invitations for select to supabase_auth_admin using (true);
