# Plan 013: Replace Clerk with Supabase Auth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Steps marked **OPERATOR** need a decision or a
> dashboard only the operator has: stop, say exactly what is needed, and
> wait. When done, update the status row for this plan in `plans/README.md` —
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git log --oneline 639e268..HEAD`, then
> `git grep -n -l '@clerk/' -- src .storybook`. It should list the 10 `src/`
> files in the "Current state" table (all but the two sign-in routes), plus
> `.storybook/main.ts` and `.storybook/mocks/clerk-server.ts`. If another
> file has started using Clerk, add it to Step 6's list before you start.

## Status

- **Priority**: P1. It must land before Opening Round 2027 (early March).
- **Effort**: L
- **Risk**: HIGH. Every Tipster's id changes, and a wrong mapping would
  move or lose Tips. Steps 1–7 are ordinary code changes behind a branch.
  Step 8 (the cutover) changes production data, and Step 9 makes the change
  hard to undo.
- **Depends on**: none. Plan 012's history rewrite (Step 6 there) changes
  commit hashes. If it lands first, re-run this plan's drift check against
  the new `main`.
- **Category**: auth / migration
- **Planned at**: commit `639e268`, 2026-10-21, after a conversation with the
  operator. The decision and the options it beat are in
  `docs/adr/0006-supabase-auth-replaces-clerk.md`. Read it first, and the
  Profile, Invitation and Tipster entries in `GLOSSARY.md`.

## Why this matters

Clerk's free plan ends every session 7 days after sign-in. During the 2026
Season, Tipsters had to sign in every week and complained about it. Many are
older and forget passwords. Supabase Auth, on the plan we already use, gives
sessions with no time limit, plus Google and Facebook sign-in, for free.

The operator wants the site invite-only: a stranger with a Google or Facebook
account must not be able to sign in.

It's the off-season, so nobody is tipping. That makes this the cheapest time
for a cutover that changes every Tipster's id.

## The model

| Table          | One row per                        | Holds                                                        |
| -------------- | ---------------------------------- | ------------------------------------------------------------ |
| `invitations`  | email address allowed to join      | the address, who invited it, when, when it was accepted      |
| `profiles`     | person on the site (a Profile)     | name and photo for every App; created on first sign-in       |
| `afl_tipsters` | Profile who has joined AFL Tipping | `joined_at`, the date Auto-tips start from (`docs/adr/0001`) |

A Profile joins AFL Tipping the first time they open it: the first AFL
Tipping server function they call creates their `afl_tipsters` row.

## Current state (verified at `639e268`)

**Where Clerk is used** (every row imports Clerk, except the two sign-in
routes):

| File                                                  | What it uses                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/start.ts`                                    | `clerkMiddleware()` as the request middleware, except in the Demo                                                                                                                    |
| `src/routes/__root.tsx`                               | `<ClerkProvider>` around the document, except in the Demo                                                                                                                            |
| `src/routes/_authenticated.tsx`                       | `auth()` in the `getAuthState` server function; redirects to `/sign-in?redirect_url=…`                                                                                               |
| `src/features/auth/use-current-user.ts`               | `useUser()`, mapped to `CurrentUser = { id, displayName, imageUrl }`                                                                                                                 |
| `src/components/header.tsx`                           | `<UserButton>` lazy-loaded and laid invisibly over our own `<Avatar>`: it gives the menu and sign-out                                                                                |
| `src/features/auth/pages/sign-in.tsx`                 | `<SignIn>`, plus dev-only quick-login buttons that sign in with a password through `useClerk()`                                                                                      |
| `src/routes/sign-in.tsx`, `src/routes/sign-in.$.tsx`  | No Clerk import. Both render `SignInPage`; the splat exists for Clerk's path routing. Both validate `redirect_url` (must start with `/`)                                             |
| `src/routes/sign-up.tsx`                              | `<SignUp>`                                                                                                                                                                           |
| `src/routes/api/live-scores.ts`                       | `auth()` before relaying the stream                                                                                                                                                  |
| `src/features/afl-tipping/api/tips.ts`                | `auth()` in `ensureUserAuthenticated`. `createClerkClient` from `@clerk/backend` (not in `package.json`, a transitive dependency) in `fetchTipsterJoinedAt` and `fetchAllClerkUsers` |
| `src/features/afl-tipping/demo/demo-visitor.test.tsx` | `vi.mock("@clerk/tanstack-react-start")`                                                                                                                                             |

Also: `.storybook/main.ts` aliases both Clerk entry points to
`.storybook/mocks/clerk.tsx` and `clerk-server.ts`. `.storybook/preview.tsx`'s
`withMockUser` provides `ClerkMockContext` from `mocks/clerk-mock-user.tsx`.
`group-tips-list.stories.tsx` uses `withMockUser`.

**What Clerk provides that we must replace**:

- **The Tipster list.** `fetchAllClerkUsers()` pages through every Clerk user
  to build `Tipsters` (`Map<string, Tipster>`, where
  `Tipster = { displayName, avatarUrl, joinedAt }` in `api/competition.ts`).
  `getLeaderboard`, `getGroupTips` and `getPlayerStats` call it. Today every
  Clerk user is a Tipster.
- **The join date.** `fetchTipsterJoinedAt()` returns Clerk's `createdAt`
  (milliseconds). `buildTipsterTips` and the leaderboard use it so that only
  Games whose Lockout comes after the Tipster joined get Auto-tips.
  **If the join date moves to the cutover date, every Tipster loses their
  2026 Auto-tips and the Leaderboard changes.** Step 7's script carries it
  across into `afl_tipsters.joined_at`.
- **Display name**: `firstName lastName`, else the first email, else
  `"Unknown User"`. **Avatar**: `imageUrl` (`img.clerk.com`). Those URLs stop
  working when the Clerk application is deleted.
- **Who may sign up**: Clerk lets anyone sign up today. Invitations are new.

**Database**: `afl_tipping.user_id` is `text`, holding Clerk ids (`user_…`),
in the primary key `(game_id, user_id)`. No other table holds a user id
(`cheating_reports` was dropped in `20261015000000`). RLS is on with no
policies (`docs/adr/0002`). There is no `seed.sql`.

**Supabase config**: `@supabase/ssr` `^0.12.7` is already a dependency and
unused. `supabase/config.toml` has `[auth.third_party.clerk]` enabled (unused,
per ADR 0002), `site_url = "http://127.0.0.1:3000"`, `jwt_expiry = 3600`,
refresh-token rotation on with a 10-second reuse interval. No external
providers or auth hooks are enabled.

**The Demo** (`docs/adr/0004`) registers its own `aflService`, so the
Tipster list and the session never reach it. It does read `IS_DEMO` in
`start.ts`, `__root.tsx`, `_authenticated.tsx`, `use-current-user.ts`,
`header.tsx` and the sign-in/sign-up routes. Each of those must keep its Demo
branch.

## Scope

**In scope**: everything in "Current state"; the three tables, the hook and
the migrations; server-side auth in `src/features/auth/`; a new sign-in page
and an OAuth callback route; a privacy page (Meta requires one); a one-off
migration script; `docs/inviting.md`; `supabase/config.toml`;
`.env.example`; Storybook mocks; `AGENTS.md`, `docs/adr/0002`,
`docs/README.md`, `docs/manual-testing.md` and `plans/README.md`.

**Out of scope**: an admin page for Invitations (the operator uses
Supabase's Table Editor; a page belongs with a permissions system later);
letting Tipsters invite others; passkeys or MFA; Apple sign-in; a custom
domain for the consent screen; editing a display name; renaming
`afl_tipping.user_id` to match the glossary (see Notes); performance finding
#4 in `plans/README.md`.

## Git workflow

- Branch: `advisor/013-supabase-auth`.
- One commit per step, scoped per `AGENTS.md`, for example
  `supabase: add profiles, invitations and afl_tipsters`,
  `auth: sign in with Supabase on the server`,
  `afl-tipping: read Tipsters from the database, not Clerk`,
  `auth: replace the Clerk sign-in page`,
  `components: sign out from the header menu`.
- Do NOT merge, push, deploy or touch production until Step 8, and only with
  the operator. Start from a clean `main`: if the working tree has the
  operator's uncommitted work, stop and ask.

## Steps

### Step 1: OPERATOR — decisions

Ask all of these at once and record the answers in this plan's row in
`plans/README.md`. ADR 0006 assumes the recommended answers. If the operator
picks otherwise, update the ADR in the same commit.

1. **Sign-in methods**
   - **Google and Facebook** (recommended): no password to forget.
   - **Emailed one-time code** (recommended if any Tipster has neither
     Google nor Facebook, or signs in to them with a different address than
     the one they're invited with): needs an SMTP provider and a domain to
     send from (Step 2). Without one, leave it out and add it later.
   - **Passwords**: recommend none.
2. **Who is on Clerk now**: in the Clerk dashboard → Users, the number of
   users and how each signed in (password, Google, other). The script in
   Step 7 invites every one of them, by their Clerk email.
3. **Cutover date**: a weekday evening in the off-season, at least three
   weeks before Opening Round 2027. That leaves time for stragglers and for
   the Clerk rollback window in Step 9.
4. **Privacy page wording**: Step 6 adds `/privacy` because Meta requires a
   privacy policy URL and data deletion instructions. The operator supplies
   or approves the text, including the contact email for deletion requests.

### Step 2: OPERATOR — providers and dashboards

The executor writes these out as a checklist for the operator and waits.
Replace `<ref>` with the project ref from `SUPABASE_URL`.

1. **Supabase → Authentication → Sign In / Providers**: turn on Google and
   Facebook. Leave "Allow new users to sign up" **on**: the hook (Step 3)
   decides who may join, and turning sign-ups off would block invited people
   too. Turn on Email only if the emailed code was chosen. The app never
   offers passwords; if the dashboard can turn off password sign-in
   separately from email codes, do it.
2. **Supabase → Authentication → URL Configuration**: Site URL is the
   production origin. Redirect URLs: `https://<production>/auth/callback`,
   `https://*-<vercel-team>.vercel.app/auth/callback` for previews, and
   `http://localhost:3000/auth/callback`.
3. **Supabase → JWT Keys**: confirm the project signs with an asymmetric key
   (ECC or RSA). If it still uses the legacy shared secret, migrate it.
   `getClaims()` then verifies tokens locally instead of calling the Auth
   server on every request.
4. **Google Cloud Console** (a project of its own):
   - OAuth consent screen: app name "Hot Shots", support email, app domain,
     privacy policy `https://<production>/privacy`, scopes `openid`,
     `email`, `profile` only (so no Google verification review). Set
     publishing status to **In production**: in testing mode only listed
     test users can sign in.
   - Credentials → OAuth client ID, type Web application. Authorized
     redirect URIs: `https://<ref>.supabase.co/auth/v1/callback` and, for
     local, `http://127.0.0.1:54321/auth/v1/callback`.
   - Paste the client ID and secret into Supabase's Google provider.
5. **Meta for Developers**: create an app (use case "Authenticate and request
   data from users with Facebook Login"). Add the `email` permission
   (`public_profile` is included). Valid OAuth Redirect URIs: the same two
   callback URLs. Set the privacy policy URL and the data deletion
   instructions URL (`https://<production>/privacy#delete`). Switch the app
   to **Live**. Paste the app ID and secret into Supabase.
6. **SMTP** (emailed code only): a provider with a free tier (Resend, Postmark
   or Brevo, for example), with a verified sending domain. Supabase →
   Authentication → SMTP Settings. Edit the "Magic Link" email template so it
   shows `{{ .Token }}` (the six-digit code) instead of a link.
7. **Vercel**, Production and Preview environments: add
   `SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_…` key, server-only, no
   `VITE_` prefix). Leave the Clerk variables in place until Step 9.
8. **Local**: the operator adds the Google and Facebook secrets to `.env` as
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` and
   `SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET`, and the client IDs as
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
   `SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID`, for Step 3's `config.toml`.

The hook itself is switched on in Step 8, after its migration reaches
production.

**Verify**: the operator confirms each item. Steps 3–7 can start before this
is done, but Step 8 can't.

### Step 3: Database — Profiles, Invitations, Tipsters and the hook

One migration, `supabase/migrations/<timestamp>_profiles_invitations_and_tipsters.sql`.
Names follow `GLOSSARY.md`: a **Profile** is the person on the site, a
**Tipster** is a Profile who has joined an App, and an **Invitation** lets an
email address join.

```sql
-- docs/adr/0006. RLS is on with no policies for anon or authenticated, like
-- every table (docs/adr/0002); the app reads these with the secret key.

-- A person on the site. Created by the trigger below on first sign-in.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  -- Set only for people migrated from Clerk. Dropped in Step 9.
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
      split_part(new.email, '@', 1),
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
```

Check the hook's event shape (`event -> 'user' ->> 'email'`) against
Supabase's "Before User Created hook" docs before relying on it, and fix the
path if it differs.

In `supabase/config.toml`:

- Delete the `[auth.third_party.clerk]` block.
- `site_url = "http://localhost:3000"`, and add
  `"http://localhost:3000/auth/callback"` to `additional_redirect_urls`.
  (The current entry is `https://127.0.0.1:3000`, which is wrong anyway.)
- `[auth.external.google]` and `[auth.external.facebook]`: `enabled = true`,
  `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` (and the
  Facebook one), `secret = "env(…_SECRET)"`, `skip_nonce_check = false`.
- `[auth.hook.before_user_created]`: `enabled = true`,
  `uri = "pg-functions://postgres/public/hook_before_user_created"`. If the
  installed Supabase CLI rejects the key, STOP: the local stack can't test
  invitations.
- `[auth.email]`: keep `enable_signup = true`, and set
  `enable_confirmations = false`. Local dev keeps passwords, for the dev
  quick-login buttons only (Step 6).

**Verify**: `npx supabase db reset` succeeds. In local Studio:

1. Add user `stranger@example.com` (Authentication → Add user). **Expected**:
   refused with `not-invited`. If Studio's admin path skips the hook, note it
   and check the same thing through Step 6's sign-in page instead.
2. Insert `invited@example.com` into `invitations`, then add that user.
   **Expected**: a `profiles` row with `display_name` `invited`, and the
   invitation's `accepted_at` set.
3. `select relname, relrowsecurity from pg_class where relname in ('profiles', 'invitations', 'afl_tipsters')`
   returns `true` for all three.

### Step 4: Server-side auth

All of this is server-only. The browser gets no Supabase client (ADR 0002,
ADR 0006).

1. **`src/lib/supabase.ts`**: add `getSupabaseAuthClient`, a
   `createServerOnlyFn` beside `getSupabaseServerClient`. It calls
   `createServerClient` from `@supabase/ssr` with `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY`, and wires cookies to TanStack Start's
   `getCookies()` / `setCookie()` from `@tanstack/react-start/server`.
   Cookie options: `httpOnly: true`, `secure` in production,
   `sameSite: "lax"`, `path: "/"`. Keep `@supabase/ssr`'s long default
   `maxAge`: Supabase Auth, not the cookie, decides when a session ends.
   Update the file's docblock: it now holds two clients, and says why the
   auth one is publishable-key and cookie-bound while the data one is
   secret-key. Throw clearly if `SUPABASE_PUBLISHABLE_KEY` is missing, like
   the existing checks.
2. **`src/features/auth/api/session.ts`**:
   - `getSessionUserId(): Promise<string | null>`. Calls
     `supabase.auth.getClaims()` and returns `claims.sub`, the Profile id.
     With no `jwt` argument, `getClaims` reads the session first, which
     refreshes an expired access token through the refresh token and writes
     the new pair through `setAll`, so this one call also keeps the session
     alive. **Prove that in this step's test, not by assumption**: if
     `getClaims` doesn't refresh in the installed version, call
     `getSession()` first.
   - Parallel server functions may refresh the same expired token at once.
     The 10-second reuse interval covers that. Don't lower it.
   - `safeRedirectPath(value: unknown): string`. Returns the value if it is
     a string starting with `/` and not `//` or `/\`, else
     `"/afl-tipping/tips"`. Pure, so it gets unit tests. Use it everywhere a
     `redirect_url` or `next` is followed, and in the two sign-in routes'
     `validateSearch`.
3. **Server routes** in `src/routes/auth/`:
   - `oauth.$provider.ts`, GET: `provider` must be `google` or `facebook`
     (else 404). It calls `signInWithOAuth` and returns a 302 to `data.url`.
     The PKCE verifier lands in a cookie through `setAll`:

     ```ts
     const { data, error } = await supabase.auth.signInWithOAuth({
       provider,
       options: {
         redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
         skipBrowserRedirect: true,
         scopes: provider === "facebook" ? "email" : undefined,
       },
     });
     ```

   - `callback.ts`, GET: on `code`, `exchangeCodeForSession(code)`. Then, if
     the Profile's `avatar_url` is null, fill it from `user.user_metadata`
     (`avatar_url` or `picture`): migrated Profiles start without one (Step
     7). Then 302 to `safeRedirectPath(next)`. On an `error` parameter or a
     failed exchange, 302 to `/sign-in?error=<reason>` and log the detail.
     When the hook turned the sign-in away, `reason` is `not-invited`. Find
     out how Supabase passes the hook's message back (likely
     `error_description`) in Step 7.4's test, and match on it there.
4. **Server functions** in `session.ts`:
   - `signOut()`: `supabase.auth.signOut({ scope: "local" })`.
   - Emailed code only: `sendSignInCode({ email })` calls `signInWithOtp`
     with `shouldCreateUser: true` (the hook still turns away uninvited
     addresses). `verifySignInCode({ email, code })` calls
     `verifyOtp({ type: "email" })`. Validate both with Zod. Both return the
     repo's result shape (`{ ok: true } | { ok: false; reason; detail? }`),
     not a throw, with `reason`s `not-invited`, `rate-limited`,
     `code-expired` and `code-wrong`.
   - Dev quick-login only: `devSignInWithPassword({ email, password })`. It
     refuses unless `process.env.NODE_ENV !== "production"`, and is
     reachable only from a component behind `import.meta.env.DEV`.
5. **Tests** (`session.test.ts`): `safeRedirectPath` accepts `/afl-tipping`,
   and rejects `//evil.com`, `/\evil.com`, `https://evil.com`, `undefined`
   and numbers. Mock `@supabase/ssr` to check that `getSessionUserId`
   returns `null` with no session and writes refreshed cookies when it
   refreshes.

**Verify**: `npm run typecheck` and `npm run test:ci`.

### Step 5: Tipsters from the database

1. **`src/features/afl-tipping/api/tipsters.repository.ts`**, shaped like
   `tips.repository.ts` but following the result convention in `AGENTS.md`.
   Validate rows with a Zod schema at the boundary, as the Squiggle schemas
   do.
   - `joinAflTipping(profileId): Promise<{ ok: true; joinedAt: number } | { ok: false; reason: string; detail?: string }>`.
     An upsert on `profile_id` that sends only `profile_id`, so an existing
     row keeps its `joined_at`, returning `joined_at` as milliseconds. This
     is how a Profile becomes a Tipster.
   - `getTipsters(): Promise<{ ok: true; tipsters: Tipsters } | { ok: false; … }>`.
     One select from `afl_tipsters` with the joined
     `profiles (display_name, avatar_url)`, mapped to the existing `Tipster`
     type and keyed by `profile_id`. Profiles who never opened AFL Tipping
     aren't in it.
2. Register it as `tipstersRepository` in `ServiceTypes` and in
   `src/app/router.tsx`, next to `tipsRepository`.
3. **`tips.ts`**: replace `ensureUserAuthenticated` with `ensureTipster()`.
   It calls `getSessionUserId()`, throws `"User not authenticated"` on
   `null` as now, then `joinAflTipping(userId)`, and returns
   `{ userId, joinedAt }`. Every handler calls it, so opening any AFL
   Tipping page joins. `getTips` uses its `joinedAt` and stops calling
   `fetchTipsterJoinedAt`. The other three read `getTipsters()` instead of
   `fetchAllClerkUsers()`. Throw on `ok: false`, as the handlers already do
   on failure. Delete both Clerk functions and the two Clerk imports.
4. **`src/routes/api/live-scores.ts`**: `getSessionUserId()` instead of
   `auth()`. It needs a signed-in Profile, not a Tipster. Update the
   docblock's "Clerk session" wording, and ADR 0005's "checks the Clerk
   session".
5. **Tests**: `tipsters.repository.test.ts` maps rows to `Tipster`s
   (including `joinedAt` in milliseconds and a null avatar) and returns
   `ok: false` on a Supabase error. Re-run `competition.test.ts` and
   `auto-tips.test.ts` unchanged: they must still pass, which shows the
   scoring rules didn't move.

**Verify**: `npm run typecheck`, `npm run test:ci`.
`git grep -n clerk -- src/features/afl-tipping/api src/routes/api` prints
nothing. Against the local stack, call `joinAflTipping` twice for one Profile
and check `joined_at` doesn't change.

### Step 6: UI

1. **`src/app/start.ts`**: drop `clerkMiddleware`. Session refresh happens
   in `getSessionUserId`, so no request middleware is needed. If
   `requestMiddleware` ends up empty, remove the option and the `IS_DEMO`
   import.
2. **`src/routes/__root.tsx`**: drop `<ClerkProvider>` and its Demo branch.
   `RootDocument` returns `page` directly.
3. **`src/routes/_authenticated.tsx`**: `getAuthState` calls
   `getSessionUserId()`. Keep the Demo branch and the `redirect_url` redirect
   as they are. Fix the comment ("Clerk middleware reads the session
   cookie").
4. **Current user** is the Profile, site-wide. Add a `getCurrentUser` server
   function in `src/features/auth/api/session.ts` that returns
   `CurrentUser | null` from `profiles`. Add `currentUserQueryOptions` (key
   `["auth", "current-user"]`) in `src/features/auth/queries.ts`.
   `use-current-user.ts`: replace `useClerkCurrentUser` with a hook that
   reads that query and returns `undefined` while loading or signed out.
   Keep the Demo branch and the module-load choice (the docblock explains
   why). Have `_authenticated.tsx`'s `beforeLoad` prefetch the query with
   `context.queryClient.ensureQueryData` so the header doesn't flash.
5. **`src/components/header.tsx`**: delete the lazy `UserButton` and its
   invisible overlay. Wrap the `<Avatar>` in the existing
   `~/components/ui/dropdown-menu`: the display name, then "Sign out". Sign
   out calls `signOut()`, runs `queryClient.clear()` and removes
   `REACT_QUERY_OFFLINE_CACHE` from `localStorage` (as `SignInPage` does
   today), then navigates to `/sign-in`. The Demo keeps no menu. Give the
   trigger an accessible name ("Account menu for {displayName}").
6. **Sign-in page** (`src/features/auth/pages/sign-in.tsx`), using the
   shadcn `Button` and `Card`:
   - At the top: "Hot Shots is invite-only. Sign in with the Google or
     Facebook account that uses the email address you were invited with."
   - "Continue with Google" and "Continue with Facebook" are plain `<a>`
     links to `/auth/oauth/google?next=<redirect_url>`. Navigating the whole
     page is what makes the OAuth redirect work.
   - Under the Google button, in muted small text: "Google will say you're
     continuing to <ref>.supabase.co. That's our sign-in service." Put the
     actual host in, from `SUPABASE_URL` passed down by the route loader.
   - Emailed code only: an email field and "Email me a code". Then a
     six-digit code field (`inputMode="numeric"`,
     `autoComplete="one-time-code"`) with "Sign in" and "Send a new code".
   - Each `reason`, from the code functions or from `?error=`, shows as a
     plain sentence above the buttons. For `not-invited`: "That account's
     email address isn't on the invite list. Try the Google or Facebook
     account that uses the address you were invited with." Don't suggest
     getting the other address invited: for a migrated Tipster that makes a
     second, empty Profile (Step 9.1).
   - Keep the `queryClient.clear()` effect and `data-app-ready`.
   - Dev quick-login stays, behind `import.meta.env.DEV`, calling
     `devSignInWithPassword` and then a full page load to the redirect.
     These accounts now live in the local Supabase, and need an Invitation
     first: document both in `.env.example`'s dev-user comment.
7. **Routes**: delete `src/routes/sign-in.$.tsx` (Clerk path routing only).
   `src/routes/sign-up.tsx` becomes a `beforeLoad` redirect to `/sign-in`,
   so old bookmarks work. An invited person's first sign-in creates their
   Profile.
8. **Privacy page**: `src/routes/privacy.tsx` with the operator's text from
   Step 1, a `#delete` section for deletion requests, and no auth guard.
   Link it from the sign-in page's footer.
9. **`docs/inviting.md`**, and a row for it in `docs/README.md` ("You want to
   let someone join, or stop an address joining"):
   - **Invite**: Supabase → Table Editor → `invitations` → Insert row, with
     the email in lower case. Then send them the site's link yourself. No
     email goes out.
   - **They can't sign in**: their Google or Facebook account uses another
     address. Ask which one, and invite that too, unless they're a migrated
     Tipster (Step 9.1's fix applies).
   - **Stop an address joining**: delete its row. **Remove a person**:
     Supabase → Authentication → Users → delete. Their Profile, Tipster row
     and Tips go with it (`on delete cascade`), so warn before doing it
     mid-Season.
10. **`.env.example`**: remove the Clerk block. Add
    `SUPABASE_PUBLISHABLE_KEY` ("server-only, no VITE_ prefix; Local:
    `npx supabase status`") and the four `SUPABASE_AUTH_EXTERNAL_*`
    variables. Keep the warning that every `VITE_*` variable is inlined: the
    dev-user lookup's dynamic `import.meta.env[…]` still causes it after
    Clerk is gone.

**Verify**: `npm run typecheck`, `npm run check`, `npm run test:ci`,
`npm run build`. With `npm run dev` and the local stack:

- With the operator's Google address invited: sign in with Google, see the
  tips page, and check that an `afl_tipsters` row now exists. Sign out from
  the header and land on `/sign-in`.
- With an uninvited Google account: sign in is refused, and the page shows
  the `not-invited` sentence. No `auth.users` or `profiles` row is created.
- Visit `/afl-tipping/tips` signed out, get redirected with `redirect_url`,
  and land back on it after sign-in.
- `/auth/callback?next=//evil.com` lands on `/afl-tipping/tips`.
- `npm run dev:demo`: no sign-in anywhere, and "You" in the header.

### Step 7: Tests, Storybook and the migration script

1. **Storybook**: delete `.storybook/mocks/clerk.tsx`, `clerk-server.ts` and
   `clerk-mock-user.tsx`, and the two Clerk aliases in `main.ts` (fix the
   comment above them). `withMockUser` in `preview.tsx` keeps its name and
   signature but seeds the story's `QueryClient` with
   `setQueryData(["auth", "current-user"], user)`. Map `MockUser` to
   `CurrentUser` and drop the Clerk-shaped fields. Add a `header.stories.tsx`
   if none exists, with the menu open.
2. **`demo-visitor.test.tsx`**: replace the Clerk mock. The non-Demo case
   seeds the query cache instead.
3. **`scripts/migrate-clerk-users.ts`**, in the style of
   `backfill-underdog-current-round.ts` (manual `.env` parse, `npx tsx`,
   docblock with usage). It reads `CLERK_SECRET_KEY`, `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY`. Dry run by default; `--apply` writes. Every Clerk
   user is a Tipster today, so each one gets an Invitation, a Profile and an
   `afl_tipsters` row:
   - Page through Clerk users with `createClerkClient` (as `tips.ts` does
     today; `@clerk/backend` is still installed).
   - For each one, take the primary email, lower-cased. With no email,
     report the user and skip them.
   - If a Profile already has this `clerk_user_id`, skip: the script must be
     safe to re-run.
   - Upsert the Invitation for the email, so the hook lets the account in
     whether or not the admin API runs hooks.
   - `auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name } })`,
     with `full_name` built the way `fetchAllClerkUsers` builds
     `displayName`. If the email already exists in Supabase Auth, look that
     user up instead. The trigger creates the Profile.
   - Update the Profile: `display_name`, `clerk_user_id`, and
     `avatar_url = null`. Clerk's image URLs die with the Clerk app; the
     callback fills in Google's or Facebook's photo on first sign-in.
   - Upsert `afl_tipsters` with `joined_at = new Date(clerkUser.createdAt)`,
     overwriting any later date.
   - Print one line per user: Clerk id, email, how they signed in to Clerk
     (`externalAccounts[].provider` and its email, or "password"), new id,
     and created / existing / skipped. Flag anyone whose Google or Facebook
     email differs from their primary email: they'll be turned away at
     sign-in (Step 9.1). Write the full mapping to a file under the OS temp
     directory. It contains emails, so never write it into the repo.
   - Exit non-zero if any Clerk user who has Tips in `afl_tipping` was
     skipped.
4. **Test sign-in for a migrated Tipster locally** before the cutover.
   Supabase's docs describe linking an OAuth sign-in to an existing user by
   email, but don't explicitly cover one created by the admin API. Run the
   script's account-creation part for the operator's own Google address,
   then sign in with Google locally. **Expected**: the same `auth.users` id,
   now with a `google` identity; one Profile; the hook didn't turn it away.
   Also record here how the hook's `not-invited` reaches the callback (Step
   4.3).

**Verify**: `npm run test:ci`, `npm run storybook` (the header, the group
tips list and every story using `withMockUser` render), `npm run build`.
`git grep -n -i clerk -- src .storybook` prints nothing. Run the script dry
against **local**, with Clerk's development instance keys, and read the
report.

### Step 8: OPERATOR — cutover

On the date chosen in Step 1, with the executor. The old code and the new
code can't both read `afl_tipping` correctly, so items 5–7 run back to back.
Nobody tips in the off-season, so the minutes in between show empty tips to
nobody.

1. **Snapshot the Leaderboard**: signed in on production as the operator,
   save the responses of `getLeaderboard` and `getPlayerStats` (browser
   devtools → Network → copy response) to a file outside the repo.
2. **Back up** `afl_tipping`: Supabase → Database → Backups, or
   `npx supabase db dump --data-only -t afl_tipping` to a file outside the
   repo.
3. From the branch, `npx supabase db push`. It applies only Step 3's
   migration, because the remap migration isn't written until item 5. Then
   Supabase → Authentication → Hooks → Before User Created → Postgres
   function `public.hook_before_user_created`, enabled.
4. Run `scripts/migrate-clerk-users.ts` against production: dry run, read the
   report with the operator, then `--apply`. **Expected**: an Invitation,
   Profile and `afl_tipsters` row per Clerk user with Tips, and exit code 0.
5. Add and push the remap migration,
   `supabase/migrations/<timestamp>_point_tips_at_afl_tipsters.sql`:

   ```sql
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

   alter table afl_tipping
     alter column user_id type uuid using user_id::uuid,
     add constraint afl_tipping_user_id_fkey
       foreign key (user_id) references afl_tipsters (profile_id) on delete cascade;
   ```

   On a fresh local database the table is empty, so it is a no-op there. If
   the exception fires, the whole migration rolls back: STOP.

6. Merge the branch and deploy to production right away.
7. **Check**:
   - The operator signs in with Google as themselves and sees their 2026
     Tips, Score and Auto-tips.
   - The Leaderboard and player stats match item 1's snapshot, Tipster for
     Tipster (names, Scores, Margin differences and ranks; only ids
     differ).
   - `select count(*) from afl_tipsters` equals the number of Clerk users
     with Tips.
   - An uninvited Google account is turned away in production.
   - Live scores still connect (`/api/live-scores` returns 401 signed out
     and streams signed in). There won't be a live Game; checking the status
     code is enough.
8. **Tell the Tipsters** (operator): sign-in has changed. They should use
   the Google or Facebook account with the email Hot Shots knew them by (or
   the emailed code), and they'll stay signed in from now on. Send the
   script's flagged Tipsters (item 4) a personal note.

**Rollback**, before Step 9 only: turn off the hook, redeploy the previous
production deployment in Vercel, then:

```sql
alter table afl_tipping drop constraint afl_tipping_user_id_fkey;
alter table afl_tipping alter column user_id type text using user_id::text;
update afl_tipping set user_id = profiles.clerk_user_id
from profiles where afl_tipping.user_id = profiles.id::text;
```

People invited and joined after the cutover have no Clerk id, so their Tips
can't go back. Say so if rolling back.

### Step 9: Remove Clerk (two weeks after Step 8, if nothing rolled back)

1. **Stragglers**: a migrated Tipster whose Google or Facebook account uses a
   different address from their Clerk one is turned away (the script flagged
   them). Inviting the new address would give them a second, empty Profile.
   Instead, change the existing account's email: in Supabase → Authentication
   → Users, or `auth.admin.updateUserById(id, { email: newEmail, email_confirm: true })`,
   and add an Invitation for the new address. Their next Google or Facebook
   sign-in links to the old account, Tips and all. If the emailed code is
   on, they can also just use it with their old address.
2. `npm uninstall @clerk/tanstack-react-start`. Check that `@clerk/backend`
   is gone from `package-lock.json`. Delete `scripts/migrate-clerk-users.ts`
   (git history keeps it).
3. A migration to drop `profiles.clerk_user_id`.
4. **Docs**:
   - `AGENTS.md`: Tech Stack ("Auth: Supabase Auth, invite-only, sessions in
     server-set cookies, `docs/adr/0006`"); Server Functions ("Use Clerk for
     auth" becomes `getSessionUserId()`, and AFL Tipping's
     `ensureTipster()`); a line under "Apps on this site" that each App has
     an `<app>_tipsters` table its Profiles join on first open; Writing
     Tests (drop "Mock `@clerk/tanstack-react-start`"); Writing Stories
     (`withMockUser` now seeds the current-user query).
   - `docs/adr/0002`: "check the Clerk session" becomes "check the session".
     Replace the last Consequence (the unused Clerk block is gone) with two:
     the one policy in the database lets `supabase_auth_admin` read
     `invitations` for the hook, and a browser Supabase client would also
     need ADR 0006 revisited.
   - `docs/manual-testing.md`: replace the Clerk lines (88, 107) with Step
     6's sign-in checks, the uninvited-account check and the iPhone check
     below.
   - `plans/README.md` finding #4: it re-reads every Tipster row, not every
     Clerk user, which is one query now. Each AFL Tipping server function
     also upserts the caller's `afl_tipsters` row.
5. **OPERATOR**: remove `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
   `CLERK_SIGN_IN_URL` and `CLERK_SIGN_UP_URL` from every Vercel environment
   and `.env`. Delete the Clerk production and development applications.
   **Check the Demo's Vercel project too**: it should have no Clerk keys
   already.
6. **OPERATOR, iPhone check**: in Safari and in the app installed to the
   home screen, sign in with Google, close it, and open it again the next
   day. It should still be signed in, in both. In Safari's Web Inspector,
   the `sb-…-auth-token` cookies should be `HttpOnly` and expire about 400
   days out. If OAuth started from the installed app comes back in Safari
   instead of the app, record it in this plan's row and in ADR 0006's last
   Consequence. The emailed code is the workaround there.

**Verify**: `git grep -n -i clerk -- ':!plans/' ':!docs/adr/'` prints
nothing. `npm run build`, `npm run test:ci` and `npm run check` pass.

### Step 10: Update the plans index

Set this row to DONE in `plans/README.md`, with the Step 1 decisions and the
cutover date. Delete this plan in the same commit as the README change
(plans are deleted when done; the ADR keeps the decision).

## Done criteria

- [ ] Step 1 decisions recorded, and ADR 0006 matches them
- [ ] Google and Facebook sign-in work in production, plus the emailed code
      if chosen
- [ ] An uninvited account is turned away, from every sign-in method, with a
      sentence that says why
- [ ] The session cookies are `HttpOnly`, set by the server, and survive a
      week without a visit on an iPhone
- [ ] Every Clerk user with Tips has an Invitation, a Profile, and an
      `afl_tipsters` row with their Clerk sign-up date as `joined_at`
- [ ] `afl_tipping.user_id` is a `uuid` foreign key to `afl_tipsters`
- [ ] The Leaderboard and player stats match the pre-cutover snapshot
- [ ] `docs/inviting.md` says how to invite, uninvite and remove someone
- [ ] No Clerk package, variable, mock or doc reference left
- [ ] The Demo still runs with no sign-in

## STOP conditions

- The working tree has uncommitted work that isn't yours.
- The local Supabase CLI can't run the Before User Created hook (Step 3).
- An uninvited account gets in through any sign-in method (Steps 3, 6 and
  8.7).
- Step 7.4's test creates a second user instead of linking to the migrated
  one. The migration doesn't work as written; report and wait.
- `getClaims()` neither refreshes the session nor can be made to by calling
  `getSession()` first (Step 4).
- The migration script skips a Clerk user who has Tips, or the remap
  migration raises its exception.
- The Leaderboard after cutover differs from the snapshot in anything but
  ids.
- It's within two weeks of Opening Round and Step 8 hasn't happened. Ask the
  operator whether to pay for a month of Clerk Pro and do the cutover after
  the Season starts instead.

## Notes

- **Why the hook, not sign-ups off**: ADR 0006 has the comparison. With
  sign-ups on and the hook in place, no account exists for an uninvited
  address, and the table records who was invited.
- **Why `profiles` and `afl_tipsters`, not one `tipsters` table**: the site is
  a Hub of Apps. A Profile is the person on the site; a Tipster is a Profile
  who has joined one App, and the join date (which Auto-tips depend on)
  belongs to that App. A future App adds its own `<app>_tipsters` table.
- **`afl_tipping.user_id` keeps its name** for now, though the glossary
  avoids "user". Renaming it to `tipster_id` touches `tips.repository.ts`
  and the Demo's seed types, and adds risk to the cutover. Do it in a later,
  separate change.
- **Why not `@supabase/server`**: it verifies bearer JWTs and builds
  user-scoped clients. We have no user-scoped client (RLS has no policies for
  `authenticated`, ADR 0002), and `@supabase/ssr`'s `getClaims()` already
  verifies the cookie's token. Its TanStack Start bridge
  (`https://supabase.com/docs/reference/server/frameworks`) is worth a look
  only if a browser-facing API ever needs per-user RLS.
- **Free-plan pausing**: a free Supabase project pauses after a week without
  activity. Over the off-season it may already be paused. Restore it before
  the cutover, and check it again before Opening Round.
- **Display names don't follow later changes** to the Google or Facebook
  name. The trigger only runs on sign-up. If people want to change theirs,
  that's a small "Your name" setting, out of scope here.
- **The session-length decision** and the reasons not to set a limit are in
  ADR 0006. There's no setting to change: the free plan has no time-box or
  inactivity timeout, so open-ended sessions are the default.
- **A later permissions system** (roles such as an admin who can invite)
  would add an admin page over `invitations` and fill `invited_by`. Nothing
  here blocks it.
