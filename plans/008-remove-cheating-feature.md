# Plan 008: Remove the cheating feature and the feature-flag system it used

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat b9f6b9b..HEAD -- src/app src/routes/_authenticated.tsx src/features/afl-tipping/api src/features/afl-tipping/components/leaderboard.tsx src/features/afl-tipping/components/leaderboard.stories.tsx src/features/afl-tipping/components/cheating-popup.tsx supabase/migrations`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `b9f6b9b`, 2026-10-15

## Why this matters

The owner wants the cheating feature gone. It was an inside joke: a Tipster
could report another Tipster ("Report for cheating", hard-coded to people whose
name starts with "Ryan"), and the reported Tipster got a popup ("Cheating
detected… Okay fine, I cheated"). It never affected scores. It also brought a
whole feature-flag system (table, server functions, admin toggle, two env vars)
whose only flag is `cheating_report`. Removing both deletes two Supabase tables'
worth of attack surface (see plan 001: the tables are writable with the public
anon key) and simplifies `leaderboard.tsx` and the authenticated layout.

The owner decided (2026-10-15): remove the cheating feature **and** the
feature-flag system, and drop both tables with a migration. Existing cheating
reports are deleted; that is accepted.

## Current state

Files that exist only for this feature (delete all of them):

- `src/features/afl-tipping/api/cheating-reports.ts` — server fns `reportCheating`, `checkCheatingReports`, `dismissCheatingReport`, exported as `service`.
- `src/features/afl-tipping/api/cheating-reports.repository.ts` — Supabase access to `cheating_reports`.
- `src/features/afl-tipping/api/feature-flags.ts` — server fns `getFeatureFlag`, `setFeatureFlag` (admin-only via `process.env.ADMIN_USER_ID`), exported as `service`.
- `src/features/afl-tipping/api/feature-flags.repository.ts` — Supabase access to `feature_flags`.
- `src/features/afl-tipping/components/cheating-popup.tsx` and `cheating-popup.stories.tsx`.

Files that reference it (edit):

- `src/app/router.tsx:12-24` registers the four services:
  ```ts
  import { service as featureFlagsService } from "~/features/afl-tipping/api/feature-flags";
  import { service as cheatingReportsService } from "~/features/afl-tipping/api/cheating-reports";
  ...
  import { cheatingReportsRepository } from "~/features/afl-tipping/api/cheating-reports.repository";
  import { featureFlagsRepository } from "~/features/afl-tipping/api/feature-flags.repository";

  serviceRegistry.registerService("featureFlagsService", featureFlagsService);
  serviceRegistry.registerService("cheatingReportsService", cheatingReportsService);
  serviceRegistry.registerService("cheatingReportsRepository", cheatingReportsRepository);
  serviceRegistry.registerService("featureFlagsRepository", featureFlagsRepository);
  ```
- `src/app/service-registry.ts:3-16` — the matching `import type` lines and four `ServiceTypes` keys: `featureFlagsService`, `cheatingReportsService`, `cheatingReportsRepository`, `featureFlagsRepository`.
- `src/features/afl-tipping/api/queries.ts:9-10` defines `getFeatureFlagService` and `getCheatingReportsService`; `queries.ts:96-107` defines `aflQueries.cheatingReports()` and `aflQueries.featureFlag(key)`.
- `src/routes/_authenticated.tsx:7` imports `CheatingPopup`; `AuthenticatedContent` (lines 27-39) queries `cheatingReports()` and `featureFlag("cheating_report")` and renders the popup:
  ```tsx
  function AuthenticatedContent() {
    const { data } = useQuery(aflQueries.cheatingReports());
    const { data: cheatingFlag } = useQuery(aflQueries.featureFlag("cheating_report"));

    const showPopup = cheatingFlag?.enabled && data?.reported;

    return (
      <>
        {showPopup && <CheatingPopup reportCount={data.reportCount} />}
        <Outlet />
      </>
    );
  }
  ```
- `src/features/afl-tipping/components/leaderboard.tsx`:
  - line 21 `const ADMIN_USER_ID = import.meta.env.VITE_ADMIN_USER_ID;`
  - `LeaderboardRowProps` (31-38) has `onReport?` and `showMenuColumn?`; `LeaderboardRow` renders a `DropdownMenu` with "Report for cheating" (lines 79-97).
  - `Leaderboard()` (143-276): `isAdmin`, the `cheatingFlag` query, `toggleMutation`, `reportMutation`, the Ryan/Brooke checks (224-228), the admin "Reporting on/off" button (238-251), and `canReport`/`onReport` in the row map (255-269).
  - Keep the rank computation at lines 209-222 exactly as is (tied Tipsters share a rank; tested in `leaderboard.test.tsx:103`).
- `src/features/afl-tipping/components/leaderboard.stories.tsx:57` passes `cheatingReportsService: {}` in `parameters.services`.
- Migrations that created the tables (do **not** edit them; add a new one):
  - `supabase/migrations/20260331134138_add_cheating_reports.sql` — `create table cheating_reports (...)`
  - `supabase/migrations/20260331150436_create_feature_flags.sql` — `create table feature_flags (...)` plus a seed row `('cheating_report', false)`.

Repo conventions that apply:

- Commit messages are scope-first, no `feat:`/`fix:` type, imperative, ≤72 chars, "why" in the body (see `AGENTS.md`, "Commit messages"). Example: `afl-tipping: remove the cheating feature`.
- Third-party calls go through `serviceRegistry` (`src/app/service-registry.ts`); removing a service means removing its key from `ServiceTypes` and its `registerService` call in `router.tsx`.

## Commands you will need

| Purpose   | Command             | Expected on success                 |
| --------- | ------------------- | ----------------------------------- |
| Typecheck | `npm run typecheck` | exit 0, no errors                   |
| Lint+fmt  | `npm run check`     | exit 0 ("pass" for format and lint) |
| Tests     | `npm run test:ci`   | exit 0, all tests pass              |
| Build     | `npm run build`     | exit 0                              |

## Scope

**In scope** (the only files you should modify, create or delete):

- Delete: `src/features/afl-tipping/api/cheating-reports.ts`, `src/features/afl-tipping/api/cheating-reports.repository.ts`, `src/features/afl-tipping/api/feature-flags.ts`, `src/features/afl-tipping/api/feature-flags.repository.ts`, `src/features/afl-tipping/components/cheating-popup.tsx`, `src/features/afl-tipping/components/cheating-popup.stories.tsx`
- Edit: `src/app/router.tsx`, `src/app/service-registry.ts`, `src/features/afl-tipping/api/queries.ts`, `src/routes/_authenticated.tsx`, `src/features/afl-tipping/components/leaderboard.tsx`, `src/features/afl-tipping/components/leaderboard.stories.tsx`
- Create: `supabase/migrations/20261015000000_drop_cheating_reports_and_feature_flags.sql`
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- `src/components/ui/dropdown-menu.tsx` and the `@radix-ui/react-dropdown-menu` dependency — leaderboard was the only user, but it's a shadcn library component; keeping it costs nothing.
- The leaderboard rank logic (`leaderboard.tsx:209-222`), `getRankIcon`, the wooden spoon, and anything about scores.
- The old migrations — migrations are history; never edit an applied one.
- `.env` and the Vercel environment — removing `ADMIN_USER_ID` / `VITE_ADMIN_USER_ID` is an operator step (see Step 6). Never print their values.
- `DEMO_MODE_PLAN.md` and `plans/001-supabase-rls-lockdown.md` mention these tables; don't edit them (see Maintenance notes).

## Git workflow

- Branch: `remove-cheating` off the current main line.
- One commit for the code (Steps 1–4), one for the migration (Step 5), e.g.
  `afl-tipping: remove the cheating feature` and `supabase: drop the cheating and feature-flag tables`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Strip the cheating UI from the leaderboard

In `src/features/afl-tipping/components/leaderboard.tsx`:

- Delete the `ADMIN_USER_ID` constant (line 21).
- `LeaderboardRowProps`: remove `onReport` and `showMenuColumn`. `LeaderboardRow`: remove those params and the whole `{showMenuColumn && (...)}` block (79-97).
- `Leaderboard()`: remove `isAdmin`, the `cheatingFlag` query and `cheatingEnabled`, `toggleMutation`, `reportMutation`, `currentUserIsRyan`, `currentUserIsBrooke`, `showMenuColumn`, the `{isAdmin && (...)}` button block, and `canReport` / `showMenuColumn` / `onReport` in the row map. Keep `user` (still used for `isCurrentUser`).
- Remove now-unused imports: `useMutation`, `useQueryClient`, `DropdownMenu*`, `Flag`, `MoreVertical`, `toast`, `ServiceRegistry`. Keep `Trophy`, `Medal`, `Award`, `AlertCircle`.

In `leaderboard.stories.tsx`, delete the `cheatingReportsService: {},` line (57).

**Verify**: `grep -n -i "cheat\|report\|ADMIN\|Ryan\|Brooke\|featureFlag" src/features/afl-tipping/components/leaderboard.tsx src/features/afl-tipping/components/leaderboard.stories.tsx` → no matches.

### Step 2: Remove the popup from the authenticated layout

In `src/routes/_authenticated.tsx`, delete the `CheatingPopup` import and make `AuthenticatedContent` render only `<Outlet />`. If `useQuery` and `aflQueries` are then unused in the file, remove their imports too. If `AuthenticatedContent` becomes a bare `<Outlet />` wrapper, it's fine to point the route's `component` straight at `Outlet` — only if the route definition makes that a one-line change.

**Verify**: `grep -n -i "cheat\|featureFlag" src/routes/_authenticated.tsx` → no matches.

### Step 3: Remove the queries and the services

- `src/features/afl-tipping/api/queries.ts`: delete `getFeatureFlagService`, `getCheatingReportsService`, `aflQueries.cheatingReports` and `aflQueries.featureFlag`.
- `src/app/router.tsx`: delete the four imports and four `registerService` calls listed in Current state.
- `src/app/service-registry.ts`: delete the four `import type` lines and the four `ServiceTypes` keys.
- Delete the six files listed under "In scope → Delete" (`git rm`).

**Verify**: `npm run typecheck` → exit 0; and
`grep -rn -i "cheat\|featureFlag\|feature-flags\|feature_flags\|ADMIN_USER_ID" src` → no matches.

### Step 4: Full check, then commit

**Verify**: `npm run check` → exit 0; `npm run test:ci` → exit 0; `npm run build` → exit 0.

Commit: `afl-tipping: remove the cheating feature` with a body saying why (owner's decision; the feature-flag system had no other user).

### Step 5: Add the drop migration

Create `supabase/migrations/20261015000000_drop_cheating_reports_and_feature_flags.sql`:

```sql
-- The cheating feature and the feature-flag system it used were removed from the app.
drop table if exists cheating_reports;
drop table if exists feature_flags;
```

Commit: `supabase: drop the cheating and feature-flag tables`.

**Verify**: `git show --stat HEAD` → the one new migration file.

### Step 6: Hand the operator steps back

Do not run these yourself. Report them to the operator, in order:

1. Deploy the code first (the app must stop reading the tables before they go).
2. Apply the migration to the Supabase project (`supabase db push`, or paste the SQL into the SQL editor).
3. Remove `ADMIN_USER_ID` and `VITE_ADMIN_USER_ID` from `.env` and from every Vercel environment.

## Test plan

No new tests: this removes behaviour. The existing suites must pass unchanged,
in particular `leaderboard.test.tsx` (including the shared-rank test at line
103). If any leaderboard test asserted on the report menu or the admin toggle,
delete that test case only — and list it in your report.

## Done criteria

- [ ] `npm run typecheck`, `npm run check`, `npm run test:ci`, `npm run build` all exit 0
- [ ] `grep -rn -i "cheat\|featureFlag\|feature-flags\|feature_flags\|ADMIN_USER_ID" src` → no matches
- [ ] The six files are deleted; `supabase/migrations/20261015000000_drop_cheating_reports_and_feature_flags.sql` exists
- [ ] `git status` shows no files modified outside the in-scope list
- [ ] Operator steps from Step 6 reported
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Something outside the in-scope list still references a removed service or query after Step 3 (the grep in Step 3 finds a match in a file not listed here).
- A second feature flag besides `cheating_report` is in use anywhere (`grep -rn "featureFlag(" src`) — then the flag system isn't single-use and the owner's decision needs revisiting.
- A leaderboard test fails for a reason other than asserting on the removed report/toggle UI.

## Maintenance notes

- **Plan 001 (RLS lockdown) references both dropped tables** (its migration enables RLS on `cheating_reports` and `feature_flags`, and its verification fetches `/rest/v1/feature_flags`). If 001 runs after this plan, its executor must drop those lines; `plans/README.md` records this.
- `DEMO_MODE_PLAN.md` describes local stand-ins for `cheatingReportsService` and `featureFlagsService`; those parts no longer apply.
- If a feature flag is needed again, build it for that use rather than restoring this one: this one had no RLS and an env-var admin check.
