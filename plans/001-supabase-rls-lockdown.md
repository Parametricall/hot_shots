# Plan 001: Lock down the Supabase database so the public anon key can no longer read or write any data

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 612bab8..HEAD -- src/lib/supabase.ts supabase/migrations`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `612bab8`, 2026-07-03
- **Reviewed and implemented**: 2026-10-15, on `advisor/001-supabase-rls-lockdown` (off `auto-tips`)

## Review revisions (2026-10-15) — these override the steps below

The plan was reviewed against `046c4f8` before it was executed. Where this section and the
original steps disagree, this section is what was built:

1. **Only `afl_tipping` remains.** Plan 008 dropped `cheating_reports` and `feature_flags`, so
   the migration enables RLS on `afl_tipping` alone and the probe uses `/rest/v1/afl_tipping`.
2. **Migration timestamp.** `20260703000000` sorts before the already-committed
   `20261015000000_drop_…` migration, which `supabase db push` refuses without
   `--include-all`. The file is `20261015120000_enable_rls_lockdown.sql`.
3. **STOP condition hit, then resolved.** `src/app/router.tsx` registers `tipsRepository`, and
   the router runs on the client too, so `~/lib/supabase` and all of supabase-js shipped in
   the browser bundle. `getSupabaseServerClient` is now wrapped in TanStack Start's
   `createServerOnlyFn`, which strips its body from the client build. Verified: after
   `npm run build`, `.output/public` holds no `SUPABASE_SECRET_KEY`, `PostgrestClient` or
   `persistSession`; the client gets a stub that throws.
4. **Env var renamed to `SUPABASE_SECRET_KEY`.** The project already uses Supabase's new
   `sb_publishable_…` key; its counterpart is the `sb_secret_…` key (Dashboard → Project
   Settings → API Keys). The legacy `service_role` JWT works in the same variable.
5. **Missed caller.** `scripts/backfill-underdog-current-round.ts` built its own client from the
   anon key and would have read zero rows under RLS. It now uses `SUPABASE_SECRET_KEY`.
6. **Rollout order made explicit.** Applying the migration before the new code is live cuts the
   production app off from its own data. Order: set `SUPABASE_SECRET_KEY` in Vercel
   (Production and Preview) → deploy → smoke test → apply the migration → probe → smoke test.
7. **Extras.** Dropped the stale `supabaseUrl`/`hasKey` log fields in `tips.repository.ts`;
   recorded the decision as `docs/adr/0002-supabase-is-server-only.md`; added one line to
   `AGENTS.md` so new tables get RLS.

Not fixed here, found during the review: Clerk's `getEnvVariable` reads `import.meta.env[name]`
dynamically, so Vite inlines **every** `VITE_*` variable into the client bundle, not just the
ones the app reads. After this plan the anon key that leaks that way is inert, but no secret
may ever be a `VITE_*` variable (`.env.example` says so).

## Why this matters

The three Supabase tables (`afl_tipping`, `cheating_reports`, `feature_flags`)
have **no Row-Level Security** — no migration ever runs `enable row level
security` or `create policy`. Supabase's entire security model depends on RLS:
the anon API key is _designed to be public_ and is shipped to the browser
(`src/lib/supabase.ts` reads `import.meta.env.VITE_SUPABASE_KEY`, which Vite
inlines into the client bundle). With RLS off, anyone who loads the app can
take the anon key + project URL from the bundle and read or write every row
directly against the Supabase REST API — reading all users' tips before games
start, overwriting other people's tips, flipping feature flags, and
inserting/deleting "cheating reports". Every server-side Clerk auth check in
`tips.ts`, `feature-flags.ts`, and `cheating-reports.ts` is bypassable because
the attacker talks to the database directly, not through those server
functions.

This was confirmed live: a request to the production REST endpoint
`/rest/v1/feature_flags` using only the anon key returned the seeded flag row.

The fix in this plan closes the hole with the smallest, lowest-risk change:
move all server-side database access to a **service-role key** (a server-only
secret that bypasses RLS), then **enable RLS with no policies** so the public
anon key is denied access to every table. The server functions keep doing
exactly what they do today (they already enforce Clerk auth); they just stop
using the public key as the only gate. After this lands, the app behaves
identically for real users, but the anon key is inert against the database.

## Current state

Files involved:

- `src/lib/supabase.ts` — the single server-side Supabase client factory. Today
  it builds a client from the **public anon key** and attaches a Clerk access
  token. Full current contents:

  ```ts
  import { auth } from "@clerk/tanstack-react-start/server";
  import { createClient } from "@supabase/supabase-js";

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  export async function getSupabaseServerClient() {
    const s = createClient(supabaseUrl, supabaseKey, {
      // global: { ... commented out ... }
      async accessToken() {
        const t = (await auth()).getToken();
        return t;
      },
      // cookies: { ... commented out ... }
    });
    return s;
  }
  ```

- `supabase/migrations/` — four existing migrations, none of which touch RLS:
  - `20260331134000_create_afl_tipping.sql` — `create table afl_tipping (...)`
  - `20260331134138_add_cheating_reports.sql` — `create table cheating_reports (...)`
  - `20260331150436_create_feature_flags.sql` — `create table feature_flags (...)` + seed
  - `20260507000000_add_is_underdog_to_afl_tipping.sql` — `alter table ... add column is_underdog`

- The three repositories are the **only** callers of `getSupabaseServerClient()`
  and they all run inside TanStack Start server functions (never in the browser):
  - `src/features/afl-tipping/api/tips.repository.ts`
  - `src/features/afl-tipping/api/cheating-reports.repository.ts`
  - `src/features/afl-tipping/api/feature-flags.repository.ts`

  These repositories do **not** change in this plan — they call
  `getSupabaseServerClient()` and will transparently receive a service-role
  client instead.

Key facts that make the fix safe:

- The leaderboard, group-tips, and compliance features read **all** users' rows
  (`tips.repository.ts` `getAllTips`, `getTipsByGameIds`). A per-user RLS policy
  would break those reads. Using the service-role key (which bypasses RLS)
  preserves this behavior exactly, with no policy juggling.
- Authorization already lives in the server functions: `ensureUserAuthenticated`
  in `tips.ts:26` and `cheating-reports.ts:6`, and the admin gate in
  `feature-flags.ts:18` (`userId !== ADMIN_USER_ID` → throw). None of that
  changes.

Environment variables (names only — never print values):

- Existing, in `.env` (git-ignored) and in the deploy platform: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_KEY` (anon JWT), plus `VITE_SUPABASE_URL_PROD` /
  `VITE_SUPABASE_ANON_KEY_PROD` used by the production deploy.
- **New** required by this plan: `SUPABASE_SERVICE_ROLE_KEY` (the Supabase
  project's `service_role` secret, from Supabase Dashboard → Project Settings →
  API). It must **not** have a `VITE_` prefix, so Vite never inlines it into the
  client bundle. A server-only URL var `SUPABASE_URL` is optional; the code will
  fall back to the existing `VITE_SUPABASE_URL` for the URL (the URL is not a
  secret).

## Commands you will need

| Purpose         | Command                | Expected on success                                         |
| --------------- | ---------------------- | ----------------------------------------------------------- |
| Install         | `npm ci`               | exit 0                                                      |
| Typecheck       | `npm run typecheck`    | exit 0, no errors                                           |
| Tests           | `npm run test:ci`      | all pass (79 today)                                         |
| Lint            | `npm run lint`         | exit 0                                                      |
| Build           | `npm run build`        | exit 0                                                      |
| Apply migration | `npx supabase db push` | migration applied (needs CLI + linked project — see Step 3) |

## Scope

**In scope** (the only files you should create or modify):

- `src/lib/supabase.ts` (modify)
- `supabase/migrations/20260703000000_enable_rls_lockdown.sql` (create)
- `.env.example` (create — document the new variable name; **no real values**)

**Out of scope** (do NOT touch, even though they look related):

- The three `*.repository.ts` files — they need no changes; they call the
  factory and receive the new client transparently.
- `tips.ts`, `feature-flags.ts`, `cheating-reports.ts` — their auth checks stay.
- The existing four migration files — do not edit history; only add a new one.
- The `.env` file itself — do not print or commit it (it is git-ignored). You
  only tell the operator which variable to add (Step 3).
- Any per-user / Clerk-JWT RLS policy work — that is a deliberate future
  direction (see Maintenance notes), not this plan.

## Git workflow

- Branch: `advisor/001-supabase-rls-lockdown`
- Commit style matches this repo's history (short imperative subject, e.g.
  `Lock down Supabase tables with RLS and a server-only service-role key`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Switch the server Supabase client to the service-role key

Replace the entire contents of `src/lib/supabase.ts` with the version below.
This drops the public anon key and the Clerk `accessToken` wiring (no longer
needed — the service-role client bypasses RLS, and the server functions already
enforce identity). The client is still constructed **inside** the function, so
the key is only ever read on the server at call time.

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client. Uses the service-role key, which bypasses RLS.
 * All authorization is enforced by the calling server functions (Clerk auth).
 * This module must never be imported into a code path that runs in the browser
 * with a real key — `process.env.SUPABASE_SERVICE_ROLE_KEY` is undefined in the
 * client bundle by design (no VITE_ prefix), so a stray client-side call fails
 * loudly instead of leaking the secret.
 */
export async function getSupabaseServerClient() {
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL / VITE_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

**Verify**: `npm run typecheck` → exit 0. Then
`grep -n "accessToken\|VITE_SUPABASE_KEY" src/lib/supabase.ts` → **no matches**
(the anon key and Clerk token wiring are gone).

### Step 2: Add the RLS lockdown migration

Create `supabase/migrations/20260703000000_enable_rls_lockdown.sql` with exactly:

```sql
-- Enable Row-Level Security on all application tables and add NO policies.
-- With RLS enabled and no policy, the public anon/authenticated roles are
-- denied all access. Only the service_role key (used server-side in
-- src/lib/supabase.ts) bypasses RLS. This closes the direct-database backdoor
-- that the browser-exposed anon key otherwise opened.
alter table afl_tipping enable row level security;
alter table cheating_reports enable row level security;
alter table feature_flags enable row level security;
```

**Verify**: the file exists and contains the three `enable row level security`
statements:
`grep -c "enable row level security" supabase/migrations/20260703000000_enable_rls_lockdown.sql`
→ `3`.

### Step 3: Document the new env var and hand the deploy steps to the operator

1. Create `.env.example` (if it does not exist) documenting variable **names
   only** — no values. Include at minimum:

   ```dotenv
   # Supabase
   VITE_SUPABASE_URL=
   VITE_SUPABASE_KEY=
   # Server-only service-role secret (bypasses RLS). NEVER prefix with VITE_.
   SUPABASE_SERVICE_ROLE_KEY=
   ```

2. In your final report to the operator, tell them they must, before deploying:
   - Add `SUPABASE_SERVICE_ROLE_KEY` to local `.env` and to every deploy
     environment (production and preview), copied from Supabase Dashboard →
     Project Settings → API → `service_role` key. It must be a **server**
     (non-`VITE_`) variable.
   - Apply the migration to each Supabase project the app uses. Preferred:
     `npx supabase db push` (requires the Supabase CLI logged in and the project
     linked — this repo already has `supabase/config.toml` and a linked project
     ref under `supabase/.temp/`). If the CLI is not available in your
     environment, provide the SQL from Step 2 for the operator to paste into the
     Supabase Dashboard → SQL Editor and run.

**Do not** attempt to apply the migration yourself unless the Supabase CLI is
authenticated in your environment and `npx supabase projects list` succeeds. If
it does not, this is expected — leave application to the operator and say so.

**Verify (only if you were able to apply the migration)**: run the probe in
Step 4. Otherwise, mark Step 4 as "operator to verify after applying migration"
in your report.

### Step 4: Verify the anon key is now inert (post-migration probe)

This confirms the fix worked. It requires the migration to be applied and the
anon key + URL for the target environment. Write this throwaway script to a temp
path (not into the repo) and run it, or run the equivalent inline. It reads the
anon credentials from `.env` and asserts the anon key can no longer read
`feature_flags`.

```js
// probe-rls.mjs — reads .env, checks anon access is denied. Prints status only.
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l
        .slice(l.indexOf("=") + 1)
        .trim()
        .replace(/^["']|["']$/g, ""),
    ]),
);
// Probe the same URL/key the deployed app uses. Adjust the pair if production
// uses the *_PROD variables.
const url = env.VITE_SUPABASE_URL_PROD ?? env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY_PROD ?? env.VITE_SUPABASE_KEY;
const res = await fetch(`${url}/rest/v1/feature_flags?select=*`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const body = await res.json().catch(() => null);
const rows = Array.isArray(body) ? body.length : 0;
console.log("HTTP", res.status, "rows returned:", rows);
console.log(
  rows === 0 ? "PASS: anon key is denied / returns no rows" : "FAIL: anon key can still read data",
);
```

**Verify**: `node probe-rls.mjs` → prints `rows returned: 0` and `PASS`.
Before the migration this same probe returns at least one row; after it, zero
(RLS with no policy denies the anon role). A `401`/`403` status also counts as
PASS. Delete the temp script afterward.

## Test plan

There are no unit tests to add here — the change is a credential/permission
swap plus a SQL migration, and the existing test suite mocks the service
registry (it never touches real Supabase). The verification is:

1. Static gates stay green: `npm run typecheck`, `npm run test:ci`,
   `npm run lint`, `npm run build` all exit 0.
2. The live probe in Step 4 flips from "returns rows" to "returns 0 rows / 401".
3. Manual smoke test by the operator after deploy: sign in, submit a tip, view
   the leaderboard and group tips — all still work (server functions use the
   service-role client). Note this in your report as an operator step; you
   cannot perform it without app credentials.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:ci` exits 0 (79 tests still pass; none added)
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "accessToken\|VITE_SUPABASE_KEY" src/lib/supabase.ts` returns no matches
- [ ] `supabase/migrations/20260703000000_enable_rls_lockdown.sql` exists with 3 `enable row level security` statements
- [ ] `.env.example` documents `SUPABASE_SERVICE_ROLE_KEY` (name only, no value)
- [ ] Only in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Report to the operator lists the two manual steps (add `SUPABASE_SERVICE_ROLE_KEY`; apply the migration) and the Step 4 probe result (or that it is pending operator application)

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/supabase.ts` does not match the "Current state" excerpt (the code has
  drifted since this plan was written).
- You discover a caller of `getSupabaseServerClient()` outside the three
  repositories, or any browser/client component that imports `~/lib/supabase`
  directly (`grep -rn "lib/supabase" src`) — the service-role client must never
  reach the client bundle; investigate before proceeding.
- After applying the migration, the operator reports that the app itself can no
  longer read/write (leaderboard empty, tip submission fails). That means the
  service-role key is missing or wrong in the deploy environment — do not add
  anon/authenticated policies to "fix" it; re-check `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run build` fails with an error mentioning `process.env` or a missing
  variable at build time (indicates the secret is being pulled into the client
  bundle) — stop; the reference must stay server-only.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- **What a reviewer should scrutinize**: that `SUPABASE_SERVICE_ROLE_KEY` is
  referenced only via `process.env` (never `import.meta.env.VITE_*`), and that
  `~/lib/supabase` is imported only by server-side repository modules. Grep the
  final bundle if in doubt — the service-role value must not appear in
  `.output/public` after `npm run build`.
- **Deliberately deferred**: fine-grained per-user RLS using Clerk JWTs
  (`auth.jwt() ->> 'sub' = user_id` for writes, read-all for authenticated) is
  the more granular long-term model and is the natural home for the planned
  RBAC/permissions system (see the project's permissions plan). It requires
  configuring Clerk as a Supabase third-party auth provider in the dashboard and
  verifying the token's `sub` claim — more moving parts and more risk than this
  plan. Do that as a follow-up if/when roles land; this plan intentionally does
  the robust, low-risk lockdown first.
- If a future feature needs the browser to talk to Supabase directly (e.g.
  realtime subscriptions), that path must use the anon key **and** add explicit
  RLS policies for exactly those tables/operations — do not widen the
  service-role usage to the client.
- `tips.repository.ts:34-35` still logs `hasKey: Boolean(import.meta.env.VITE_SUPABASE_KEY ...)`.
  That log is now stale but harmless; a separate log-hygiene cleanup can remove it.
