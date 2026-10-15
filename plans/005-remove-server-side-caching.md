# Plan 005: Remove the server-side in-memory cache (`withCache`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 612bab8..HEAD -- src/features/afl-tipping/api src/features/afl-tipping/constants.ts`
> If `squiggle.serverfns.ts`, `cache.ts`, or `constants.ts` changed since this
> plan was written, re-read them and reconcile the step details before
> proceeding. Plan 004 (SSE live updates) does not touch these files.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness / architecture
- **Planned at**: commit `612bab8`, 2026-07-04

## Why this matters

`src/features/afl-tipping/api/cache.ts` is a module-level `Map` used as a TTL
cache — its own comment says it works "because the server module stays alive
between page loads". The app deploys to Vercel serverless, where that
assumption is false: each function instance has its own memory, instances are
created and destroyed constantly, and users are not routed to the same
instance. The result is a cache that sometimes hits, usually misses, and can
serve _different_ staleness to different users depending on which instance
they land on. It provides false confidence and unpredictable freshness rather
than real savings. The operator has decided to remove it and rely on the
client-side React Query `staleTime`s (already in place) to bound request
volume.

This also supersedes deferred audit finding **#4** in `plans/README.md`
("extend `withCache` to leaderboard/group-tips/compliance") — extending a
per-instance cache is the wrong direction on this platform.

## Current state

- **`src/features/afl-tipping/api/cache.ts`**: `withCache<T>(key, ttlMs, fn)`
  over a module-level `Map`, plus `clearCache()` exported for tests.
- **Sole consumers** — the 5 server functions in
  `src/features/afl-tipping/api/squiggle.serverfns.ts`:

  | Server fn                    | Cache key                 | TTL (`CACHE_DURATIONS`) |
  | ---------------------------- | ------------------------- | ----------------------- |
  | `getTeamsServerFn`           | `teams`                   | TEAMS (1h)              |
  | `getStandingsServerFn`       | `standings`               | STANDINGS (1h)          |
  | `getGamesServerFn`           | `games:${round ?? "all"}` | GAMES (1h)              |
  | `getIncompleteGamesServerFn` | `incompleteGames`         | INCOMPLETE_GAMES (1min) |
  | `getModelTipsServerFn`       | `modelTips:${round}`      | MODEL_TIPS (1h)         |

- **`CACHE_DURATIONS`** (`src/features/afl-tipping/constants.ts`) is
  **dual-use**: the same constants are client-side React Query `staleTime`s in
  `api/queries.ts` (which also uses USER_TIPS, LEADERBOARD, GROUP_TIPS). The
  client usage stays.
- **Tests**: `api/cache.test.ts` (11 tests) exercises `withCache`/`clearCache`
  directly. No other test asserts caching behavior.
- **Downstream server callers** that currently get warm-instance cache hits:
  `api/tips.ts` — `submitTip` (`getGames()` + `getModelTips(round)`),
  `getLeaderboard` (`getGames()`), `getGroupTips` (`getGames(round)`),
  `getUnderdogCompliance` (`getGames()`).
- **No other server caching exists**: no `vercel.json`, no `Cache-Control`/
  `s-maxage` headers anywhere, no other memoization of fetch results.

## Commands you will need

| Purpose              | Command                                           | Expected on success                                  |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Typecheck            | `npm run typecheck`                               | exit 0                                               |
| Tests                | `npm run test:ci`                                 | all pass (count drops by the 11 deleted cache tests) |
| Build                | `npm run build`                                   | exit 0                                               |
| Lint                 | `npm run lint`                                    | exit 0                                               |
| Dead-reference sweep | `grep -r "withCache\|clearCache\|api/cache" src/` | no hits after Step 2                                 |

## Scope

**In scope** (modify/delete only):

- `src/features/afl-tipping/api/squiggle.serverfns.ts` — unwrap the 5 calls
- `src/features/afl-tipping/api/cache.ts` — delete
- `src/features/afl-tipping/api/cache.test.ts` — delete
- `src/features/afl-tipping/constants.ts` — only if a `CACHE_DURATIONS` key is
  provably dead after the change (verify against `queries.ts` first)

**Out of scope** (do NOT touch):

- `api/queries.ts` client `staleTime`s — the client cache is the intended
  freshness mechanism and stays exactly as is.
- Do NOT add replacement caching (no `Cache-Control: s-maxage` headers, no KV,
  no re-memoization). That is a recorded follow-up, not this plan.
- `api/tips.ts` — its call patterns are unchanged (see Maintenance notes for
  the known N+1-ish concern; separate work).
- `public/sw.js` service worker and React Query localStorage persistence —
  client-side, unrelated.

## Git workflow

- Branch: `advisor/005-remove-server-side-caching`
- Single commit is fine; subject e.g.
  `Remove in-memory server cache; rely on client staleTime (Vercel serverless)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Unwrap the server functions

In `src/features/afl-tipping/api/squiggle.serverfns.ts`, replace each
`withCache(key, ttl, fn)` with a direct call, e.g.:

```ts
// before
.handler(async () => withCache("teams", CACHE_DURATIONS.TEAMS, () => fetchAllCurrentTeams()));
// after
.handler(async () => fetchAllCurrentTeams());
```

Apply to all 5 handlers (`teams`, `standings`, `games:${round}`,
`incompleteGames`, `modelTips:${round}`). Remove the now-unused `withCache`
import; remove the `CACHE_DURATIONS` import only if nothing else in the file
uses it.

**Verify**: `npm run typecheck` → exit 0; the grep sweep shows the only
remaining `withCache` references are in `cache.ts`/`cache.test.ts`.

### Step 2: Delete the cache module and its tests

Delete `src/features/afl-tipping/api/cache.ts` and
`src/features/afl-tipping/api/cache.test.ts`.

**Verify**: grep sweep → zero hits for `withCache`, `clearCache`, or imports
of `api/cache` under `src/`; `npm run typecheck` → exit 0.

### Step 3: Audit `CACHE_DURATIONS` keys

Check each key of `CACHE_DURATIONS` in `constants.ts` against remaining usage
(expect `api/queries.ts` to use most as `staleTime`). Keep every key that is
still referenced. If a key is now referenced nowhere (possible candidates:
TEAMS/STANDINGS if `queries.ts` uses `Infinity` literals for those), remove
just that key. When keys remain (they will), consider renaming the constant is
NOT in scope — leave the name alone.

**Verify**: `npm run typecheck` and `npm run lint` → exit 0.

### Step 4: Full gates + smoke

Run all four gates, then `npm run dev` and load `/afl-tipping` (tips),
standings, and leaderboard pages signed in — fixtures, standings, and
leaderboard render normally (each request now hits Squiggle fresh
server-side; client staleTimes still prevent refetch storms in the browser).

**Verify**: `typecheck`, `test:ci`, `build`, `lint` all exit 0; the three
pages load with data; no new console errors from the server functions.

## Test plan

No new tests. The change deletes behavior; the safety net is:

- `npm run test:ci` — everything except the 11 deleted `cache.test.ts` tests
  passes unchanged (server-fn and tips tests never asserted caching).
- The Step 4 manual smoke covers the live path end-to-end.

## Done criteria

ALL must hold:

- [ ] `src/features/afl-tipping/api/cache.ts` and `cache.test.ts` deleted
- [ ] Zero references to `withCache`/`clearCache`/`api/cache` under `src/`
- [ ] The 5 server fns call their fetchers directly (diff shows unwrap only — no logic changes)
- [ ] Client `staleTime`s in `queries.ts` untouched
- [ ] No replacement caching added anywhere
- [ ] `npm run typecheck`, `npm run test:ci`, `npm run build`, `npm run lint` all exit 0
- [ ] Manual smoke: tips, standings, leaderboard pages load with data
- [ ] `plans/README.md`: this plan's row updated AND deferred finding #4 annotated as superseded by 005 (if not already done at planning time)

## STOP conditions

Stop and report back (do not improvise) if:

- Any test outside `cache.test.ts` fails after the unwrap — something was
  coupled to caching semantics this plan didn't predict.
- The Step 4 smoke shows Squiggle rate-limiting or blocking (429s / blocks in
  server logs) once every request goes upstream — that changes the trade-off
  and the follow-up (CDN headers) may need to be pulled forward instead.
- You find an additional `withCache` consumer or another server-side cache not
  listed in "Current state" — the inventory was wrong; re-scope before cutting.

## Maintenance notes

- **Recorded follow-up (out of scope)**: if Squiggle request volume ever
  becomes a problem, the platform-correct shared cache on Vercel is HTTP
  response caching — `Cache-Control: s-maxage=…, stale-while-revalidate=…`
  headers on the GET server-function responses, cached by Vercel's CDN across
  all instances. That is the successor to `withCache`, not a bigger Map.
- `api/tips.ts` still re-fetches all Clerk users + games per
  leaderboard/compliance request (old audit finding #4's underlying concern).
  Removing `withCache` makes that marginally more expensive but consistent;
  fixing it properly is separate work that should follow plan 002's tests.
- README.md ("deployed with Netlify") is stale — deployment is Vercel; already
  flagged in deferred finding #6.
