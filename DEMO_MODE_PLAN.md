# Demo / Preview Data Mode Plan

Goal: support three runtime data modes from the same codebase so we can run a public demo and isolate Vercel preview deploys from production data, without needing extra Supabase projects.

## Decisions (locked in)

- **Auth in demo:** bypass Clerk entirely. Demo runs as a hardcoded guest user.
- **Seed data:** none. Demo starts empty; visitor enters their own tips.
- **Flag scope:** one env flag — `VITE_DATA_MODE`.

## Modes

| Mode    | Auth       | Tips/feature-flags/cheating-reports store | Squiggle (AFL data) | Banner |
| ------- | ---------- | ----------------------------------------- | ------------------- | ------ |
| `real`  | Clerk prod | Supabase prod                             | Real Squiggle API   | off    |
| `local` | Clerk dev  | localStorage                              | Real Squiggle API   | off    |
| `demo`  | Bypassed   | localStorage                              | Real Squiggle API   | on     |

Vercel mapping:

- Production → `real`
- Preview (existing project) → `local`
- New Vercel project, production branch = `demo` → `demo`

## Architecture

### Swap point is `aflService`, not the repository

The existing repositories (`tips.repository.ts`, `cheating-reports.repository.ts`, `feature-flags.repository.ts`) run server-side and hit Supabase. Server functions in `tips.ts` etc. wrap them. `localStorage` does not exist server-side, so we cannot swap at the repository layer.

The right seam is the **service layer** that `queries.ts` already consumes via `ServiceRegistry`:

- `aflServiceSupabase` — current `tips.ts` service, untouched.
- `aflServiceLocal` — same interface, reads/writes `localStorage`, namespaced by user id.

`router.tsx` registers one or the other based on `VITE_DATA_MODE`. Same pattern for `cheatingReportsService` and `featureFlagsService` (locals are trivial: feature flags return defaults; cheating reports become no-op submits).

`squiggleService` stays real in all modes — public API, no isolation needed.

### Auth bypass

- New `useCurrentUser()` hook in `src/features/auth/`.
  - `real` / `local` modes → wraps Clerk's `useUser()`.
  - `demo` mode → returns hardcoded `{ id: "demo-user", fullName: "Demo User", ... }`.
- Replace direct `useUser()` / `useAuth()` imports across the codebase with this hook (grep first to size the blast radius).
- `__root.tsx` — conditionally render `<ClerkProvider>` only when mode !== `"demo"`. In demo, render a passthrough wrapper.
- `_authenticated.tsx` route guard — skip the redirect when mode === `"demo"`.

### localStorage store details

- Key prefix: `hotshots:${dataMode}:${userId}:tips:${round}` — round-scoped so reads stay cheap.
- All methods async (`Promise.resolve(...)`) to keep the interface identical and TanStack Query happy.
- One safety wrapper around `JSON.parse` so a corrupt entry doesn't crash the app.

### Demo-only UI

- `<DemoBanner />` in the header when mode === `"demo"`.
- "Reset demo data" button in the banner — clears the `hotshots:demo:` namespace from localStorage.

## Out of scope / accepted tradeoffs

- Tests keep mocking the registry as they do today. No new test mode needed.
- The localStorage store does not exercise RLS, JWT plumbing, or DB constraints. Bugs in those layers will only surface in `real` mode.
- Demo data is per-browser. Clearing site data wipes it. Fine.
- No cross-device sync in demo. Fine.

## Implementation order

1. Add `VITE_DATA_MODE` flag + a `getDataMode()` helper.
2. Build `aflServiceLocal` typed against the existing service signature so TS catches drift.
3. Wire conditional registration in `router.tsx`. Verify `local` mode works locally with Clerk dev keys still in play.
4. Build `useCurrentUser` hook and migrate call sites.
5. Conditional `ClerkProvider` + `_authenticated` guard.
6. `DemoBanner` + reset button.
7. Set up new Vercel project pointing at the `demo` branch, env vars set to `demo` mode.

## Vercel env-var setup

Per-environment values for the same variable name. Existing prod vars must be edited to be **Production-only** before adding the dev/preview equivalents.

| Variable                     | Production    | Preview + Development   | Demo project |
| ---------------------------- | ------------- | ----------------------- | ------------ |
| `VITE_DATA_MODE`             | `real`        | `local`                 | `demo`       |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | `pk_test_...`           | unset/dummy  |
| `CLERK_SECRET_KEY`           | `sk_live_...` | `sk_test_...` (rotated) | unset/dummy  |
| `VITE_SUPABASE_URL`          | prod          | prod (read-only safe?)  | unset        |
| `VITE_SUPABASE_ANON_KEY`     | prod          | prod                    | unset        |

Note: in `local` mode the localStorage store means Supabase isn't actually called for tips, but env vars must still be defined to avoid build/runtime errors. Decide per service whether `local` mode keeps Supabase wired or fully shims it.
