# Plan 010: A public, browser-only Demo with a Demo clock

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Steps marked **OPERATOR** happen in a dashboard
> and only the operator can do them: stop, say exactly what is needed, and
> wait. When done, update the status row for this plan in `plans/README.md` —
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat be912f9..HEAD -- src/features/afl-tipping src/features/auth src/app src/lib src/routes src/components/header.tsx`
> If any of these changed, re-read the "Codebase facts" below against the
> current code before proceeding. On a mismatch in `tips.ts`, treat it as a
> STOP condition: Step 1 depends on its exact shape.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (Step 1 refactors every server function in `tips.ts`; Steps
  5–6 touch the root layout, the auth guard and the router)
- **Depends on**: none. It supersedes plan 002: Step 1 does 002's remaining
  extraction and more. Plan 011 (making the repo public) is independent.
- **Category**: product / portfolio
- **Planned at**: commit `be912f9`, 2026-10-17. Rewritten the same day after
  a design review with the operator; git has the earlier version.

## Why this matters

The repo is going public (plan 011) and the operator wants a Demo that
potential employers can click through with no account. Production can't serve
that: it needs a sign-in to the private Competition. A copy of the site
running on the real clock would also show nothing worth seeing for half the
year, because from October to March every Game is locked or there's no
Fixture at all.

The Demo is the 2026 Season played out in the visitor's own browser against
made-up Tipsters. A **Time control** moves the **Demo clock** Game by Game,
so the visitor can tip, watch results come in, see Auto-tips land on Games
they skipped, and watch the Leaderboard change, from Opening Round to the
Grand Final.

## Decisions (agreed with the operator 2026-10-17; do not relitigate)

1. **Browser-only.** No Supabase and no Clerk in the Demo. The visitor's Tips
   live in `localStorage`. Real auth and RLS stay visible through the code,
   the tests and the ADRs. (This beat the earlier version of this plan, which
   used its own Clerk and Supabase instances: a database shared by every
   visitor can't let each one stand at a different point in the Season.)
2. **The seam is the service registry**: the Demo registers
   `squiggleServiceDemo` and `aflServiceDemo` in place of the real services.
   Queries and components don't change. Do not prefill the TanStack Query
   cache.
3. **A committed snapshot of the 2026 Season**: Squiggle's Games, Model tips,
   teams and the Ladder after every Round, plus the made-up Tipsters and their
   Tips. The Demo never calls Squiggle.
4. **A second Vercel project** from the same repo, built with `VITE_DEMO=true`.
   No secrets. Production builds behave exactly as they do now.
5. **The Time control steps Game by Game.** Each position is "just before
   Game k starts", plus a last "Season over". There are previous/next Game and
   previous/next Round buttons, and a Round picker.
6. **Your Tips stay put when the Demo clock moves.** Going back before a Game
   unlocks your Tip on it again.
7. **Skipping past a Game gives you an Auto-tip.** The visitor counts as
   having joined before the Season (`docs/adr/0001`). Going back and tipping
   the Game removes the Auto-tip.
8. **A first visit opens just before the first Game of Round 12.** The
   position is remembered in `localStorage`.
9. **The made-up Tipsters' Tips are generated once by the snapshot script and
   committed.** About 8 personas. The app only reads them.
10. **`useCurrentUser()` replaces Clerk's `useUser`.** In the Demo it returns
    a fixed Tipster, "You". The Demo skips `ClerkProvider`, `clerkMiddleware`
    and the auth guard, and `/sign-in` and `/sign-up` redirect into AFL
    Tipping.
11. **The Time control is a bar fixed to the bottom of every AFL Tipping
    page.** It shows the position, says the other Tipsters are made up, and
    has **Reset demo** (asks for confirmation, then clears your Tips and
    position). There's no separate banner.
12. **Every step of the Demo clock tells every AFL query to refetch.** Query
    keys don't change. The Demo doesn't save the query cache to the browser.
13. **AFL Tipping renders only in the browser in the Demo** (`ssr: false`):
    its loaders run the Demo services, which need `localStorage`. The Hub
    still renders on the server.
14. **The snapshot is loaded on demand** by the Demo services, with a dynamic
    `import()`. Production bundles never include it.
15. **Underdog tips in the Demo are judged against the final Model tip.** The
    snapshot only has each Game's last Model tip. Record this in ADR 0004.
16. **Each server function's logic moves into a pure function.** The server
    functions and `aflServiceDemo` call the same code, so the Demo can't drift
    from production's rules.
17. **New glossary terms**: **Demo** and **Demo clock** (Step 8). Code names
    follow them: `useDemoClock`, `DemoTimeControl`, `aflServiceDemo`,
    `squiggleServiceDemo`.
18. **Everything else in the Demo matches production**: the Hub, the app
    manifests (installing the Demo installs "Hot Shots", as production does),
    every page and every rule.

## Codebase facts (verified at `be912f9`; trust these, do not re-derive)

### The data seam

- `src/app/router.tsx` registers `squiggleService`
  (`api/squiggle.service.ts`: `getAllCurrentTeams`, `getStandings`,
  `getGames(round?)`, `getIncompleteGames`, `getModelTips(round)`),
  `aflService` (`api/tips.ts`: `submitTip`, `getTips`, `getLeaderboard`,
  `getGroupTips`, `getPlayerStats`, each called as a server function, e.g.
  `getTips({ data: { gameIds } })`) and `tipsRepository` (server-only).
- `src/app/service-registry.ts` types services as `typeof squiggleService`
  and `typeof aflService`, and declares `ServiceTypes` as an `interface`.
  AGENTS.md says to convert it to a `type`, since this plan changes the file.
- `src/features/afl-tipping/api/queries.ts` reaches both services through
  `ServiceRegistry.getService` and nests every key under `["afl"]`
  (`aflQueries.aflKey()`).
- `router.tsx` saves the whole query cache to `localStorage`
  (`persistQueryClient`, inside `if (typeof window !== "undefined")`).

### Logic that lives inside server functions today (`tips.ts`)

All private to the module, which also imports server-only Clerk and the
registry, so none of it can run in a browser or a unit test:

- `fetchTipsterJoinedAt`, `fetchAllClerkUsers`: Clerk reads. These stay in
  `tips.ts`.
- `withAutoTips(tips, games, userMap)`: merges Auto-tips, using
  `findAutoTips` and `toAutoTipRow` (`api/auto-tips.ts`, already pure).
- `buildCompletedGameWinners`, `buildFirstGameMargins`, `scoreTips`,
  `assembleLeaderboard`: the Leaderboard. Ranking is by Score, then lowest
  Margin difference.
- `buildTippedEntries`, `buildUntippedEntries`: group Tips. Other Tipsters'
  teams and Margins stay hidden until Lockout.
- Inline in handlers: the `getTips` Auto-tip merge (`tips.ts:129-137`), the
  `submitTip` Lockout check and `isUnderdog` rule (`tips.ts:92-102`), and the
  player-stats entry mapping and sort (`tips.ts:353-370`).
  `computePlayerStats` (`api/player-stats.ts`) is already pure.
- `TipsterInfo = { displayName; avatarUrl; joinedAt }`, keyed by Clerk user id.

Plan 002 was written before player stats replaced the underdog-compliance
function it describes, so it no longer matches the code. Step 1 here
replaces it.

### Clock reads

- `utils/afl-game.ts:5`: `hasStarted = (game) => Date.now() >= game.unixTime`,
  used for Lockout everywhere.
- `api/tips.ts:134`, `:152`: `now: Date.now()` passed to `findAutoTips`.
- `hooks/use-game-start-timer.ts`: four `Date.now()` calls. **Trap:** it sets
  a `setTimeout` for `gameUnixTime - Date.now()` that calls
  `setHasStarted(true)` without re-checking. With a Demo clock that timeout
  would fire after real milliseconds pass and lock a Game wrongly.
- `squiggle/api.ts` uses `new Date().getFullYear()` for the Season. Leave it:
  the Demo doesn't call Squiggle.

### Where Game status comes from

- `AflGame.isComplete` is `game.complete === 100` (Squiggle's field).
  `AflGame.getActiveRound` is the lowest Round with an incomplete Game, used
  by `tipping-page-shell.tsx:43` and `player-stats.tsx:226` for the current
  Round. Hiding results after the Demo clock therefore moves the current
  Round with no UI change.
- Domain `AflGame` (`types.ts:33`): the result fields are `homeScore`,
  `awayScore`, `winnerTeamId` (all nullable), `complete` (number), `timeStr`
  (`"Not Started"` for an unstarted Game, `schemas.ts`). `AflModelTip` has no
  result field.

### Clerk

- `src/app/start.ts`: `requestMiddleware: [clerkMiddleware()]`.
- `src/routes/__root.tsx`: `RootDocument` wraps `<html>` in `<ClerkProvider>`.
- `src/routes/_authenticated.tsx`: `beforeLoad` calls a server function that
  reads `auth()` and redirects to `/sign-in` when signed out. It returns
  `{ userId }` into route context.
- `useUser()` is called in `components/header.tsx:27` (name, avatar, and an
  invisible `UserButton` over the avatar), and in
  `afl-tipping/components/leaderboard.tsx:114`, `group-tips-list.tsx:241`,
  `player-stats.tsx:223` (to highlight the signed-in Tipster).
- Routes `/sign-in`, `/sign-in/$`, `/sign-up` render Clerk components.

### SSR

`routes/_authenticated/afl-tipping/{tips,group-tips,stats,standings}.tsx`
loaders call `ensureQueryData` / `prefetchQuery`, which run on the server
during SSR (`setupRouterSsrQueryIntegration` in `router.tsx`).

### Repo conventions that apply

- `package.json` has `"sideEffects": false`, and `import.meta.env.VITE_*`
  values are replaced while building, so code behind a build-time
  `if (IS_DEMO)` is dropped from production bundles.
- Unit tests are `src/**/*.test.ts` (node), component tests
  `src/**/*.test.tsx`; import test APIs from `vite-plus/test`. Factories are in
  `~/features/afl-tipping/mocks/factories` (`createAflGame` etc.).
- Scripts are run with `npx tsx` (`scripts/backfill-underdog-current-round.ts`).
  `tsx` is not in `devDependencies` yet. `cross-env` is a dependency.
- A load or parse that can fail returns `{ ok: true; … } | { ok: false; reason; detail? }`.
- Squiggle asks callers to send an identifying User-Agent. Reuse the string in
  `squiggle/api.ts` (extract it to `SQUIGGLE_USER_AGENT` in
  `squiggle/constants.ts`).

## Design

### Module layout

| Path                                                             | What                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/lib/demo.ts`                                                | `IS_DEMO = import.meta.env.VITE_DEMO === "true"`             |
| `src/lib/clock.ts`                                               | `now()`, and the Demo clock store                            |
| `src/features/afl-tipping/api/competition.ts`                    | the pure functions taken out of `tips.ts` (Step 1)           |
| `src/features/afl-tipping/demo/season-2026.json`                 | the snapshot (generated, committed)                          |
| `src/features/afl-tipping/demo/snapshot.ts`                      | snapshot type + `loadSnapshot()` (dynamic import, Zod parse) |
| `src/features/afl-tipping/demo/seed-tips.ts`                     | personas + `seedTips()` (used by the script only)            |
| `src/features/afl-tipping/demo/season-as-of.ts`                  | `gameAsOf`, `standingsAsOf`                                  |
| `src/features/afl-tipping/demo/demo-positions.ts`                | the Time control's positions and moves                       |
| `src/features/afl-tipping/demo/visitor-store.ts`                 | `localStorage` for the visitor's Tips and position           |
| `src/features/afl-tipping/demo/squiggle.service.demo.ts`         | `squiggleServiceDemo`                                        |
| `src/features/afl-tipping/demo/afl.service.demo.ts`              | `aflServiceDemo`                                             |
| `src/features/afl-tipping/demo/components/demo-time-control.tsx` | `DemoTimeControl` (+ story, + test)                          |
| `src/features/auth/use-current-user.ts`                          | `useCurrentUser()`                                           |
| `scripts/snapshot-demo-season.ts`                                | writes `season-2026.json`                                    |

### `competition.ts`: the shared rules (Step 1)

Pure functions taking explicit inputs, including `now`. Names may be adjusted
to read well, but keep one function per server function:

```ts
export type Tipster = { displayName: string; avatarUrl: string | null; joinedAt: number };
export type Tipsters = Map<string, Tipster>; // by user id

export function judgeTip(args: {
  game: AflGame.Type | undefined;
  teamId: number;
  modelTip: AflModelTip | undefined;
  now: number;
}):
  | { ok: true; isUnderdog: boolean | undefined }
  | { ok: false; reason: "game-not-found" | "game-started" };

export function buildTipsterTips(args: {
  storedTips: AflUserTip[];
  games: AflGame.Type[];
  gameIds: number[];
  userId: string;
  joinedAt: number;
  now: number;
}): AflUserTip[];

export function buildLeaderboard(args: {
  tips: AllTipsRow[];
  games: AflGame.Type[];
  tipsters: Tipsters;
  now: number;
}): AflLeaderboardEntry[];

export function buildGroupTips(args: {
  tips: AllTipsRow[];
  roundGames: AflGame.Type[];
  tipsters: Tipsters;
  now: number;
}): AflGroupTipEntry[];

export function buildPlayerStats(args: {
  tips: AllTipsRow[];
  games: AflGame.Type[];
  tipsters: Tipsters;
  now: number;
}): AflPlayerStatsEntry[];
```

`AflGame.hasStarted` gains an optional second argument,
`hasStarted(game, at = now())`, and every `competition.ts` call passes `now`
explicitly. `tips.ts` handlers shrink to: authenticate, fetch (Clerk,
repository, Squiggle), call one `competition.ts` function with
`now: Date.now()`, return. Throw where they throw today (map `judgeTip`'s
`reason` to the existing error messages).

### The Demo clock: `src/lib/clock.ts`

```ts
export function now(): number; // the Demo clock if set, else Date.now()
export function setDemoNow(at: number): void;
export function subscribeDemoNow(listener: () => void): () => void;
export function getDemoNow(): number | undefined;
```

`useDemoClock()` (in `demo/`) wraps `useSyncExternalStore(subscribeDemoNow, getDemoNow)`.
Never pass `now` as the snapshot getter: `Date.now()` changes on every call
and would loop. Production never calls `setDemoNow`, so `now()` is
`Date.now()` there.

`use-game-start-timer.ts`: read `useDemoClock()`. When it's defined, return
`demoNow >= gameUnixTime` and set no timers. Otherwise behave as today, with
the timeout callback re-checking `now() >= gameUnixTime` before
`setHasStarted(true)`.

### The snapshot: `season-2026.json`

```ts
type DemoSnapshot = {
  season: number; // 2026
  capturedAt: string; // ISO
  squiggle: {
    // raw Squiggle responses, parsed by the existing Zod schemas
    teams: unknown;
    games: unknown;
    modelTips: unknown;
    standingsAfterRound: Record<string, unknown>; // round number → `q=standings;round=N` response
  };
  tipsters: { userId: string; displayName: string; joinedAt: number }[];
  tips: AllTipsRow[]; // the made-up Tipsters' Tips, whole Season
};
```

Storing raw Squiggle responses means the Demo maps DTOs to domain types
through the same schemas as production. `loadSnapshot()` does the dynamic
`import()` once (memoised), parses with Zod, and returns
`{ ok: true; snapshot } | { ok: false; reason: "parse-failed"; detail }`.
The Demo services throw on `ok: false`, so the route's error boundary shows
it.

### Seeded Tipsters: `seed-tips.ts`

```ts
type Persona = {
  userId: string; displayName: string;   // "demo-tipster-1", made-up and clearly fictional
  accuracy: number;                      // chance of tipping the winner
  underdogTipsPerRound: number;          // aimed for, outside Finals
  skipRate: number;                      // share of Games left untipped (they become Auto-tips)
};
export const PERSONAS: Persona[];        // ~8
export function seedTips(args: { personas: Persona[]; games: AflGame.Type[]; modelTips: AflModelTip[] }): AllTipsRow[];
```

- Deterministic: a small seeded PRNG (e.g. mulberry32) keyed on `userId`.
- For every Game in the Season: skip with `skipRate`; otherwise tip the
  winner with probability `accuracy`, else the loser (in a Draw, either team).
  Then flip tips against the Model tip until the Round has
  `underdogTipsPerRound` Underdog tips, where possible.
- Variety the Demo must show: one persona that usually falls short of the
  Underdog quota (`GameRules.MINIMUM_UNDERDOGS_PER_ROUND`), one with a
  noticeable `skipRate`, a front-runner, a late surge (accuracy rises in the
  second half), and at least one Perfect round somewhere in the Season.
- `margin` only on each Round's Margin game (`AflGame.getFirstGameOfRound`),
  1–60. `is_underdog` = tip ≠ Model tip, `null` when there's no Model tip.
  `created_at` = 1–72 h before the Game.
- Every persona's `joinedAt` (in the snapshot's `tipsters`) is a week before
  the Season's first Game.

### Season as of the Demo clock: `season-as-of.ts`

- `gameAsOf(game, at)`: unchanged if `game.unixTime <= at`. Otherwise
  `homeScore: null, awayScore: null, winnerTeamId: null, complete: 0,
  timeStr: "Not Started"`. Every position is just before a Game starts, and
  the snapshot only has final scores, so in the Demo "started" means
  "finished". That's an accepted simplification.
- `standingsAsOf(snapshot, games, at)`: the Ladder after the latest Round
  whose every Game has started by `at`. Before any Round is complete, use the
  Opening Round Ladder with every team's record zeroed, so no results leak.

### Positions: `demo-positions.ts`

- `buildPositions(games)`: one position per distinct Game start time, at
  start − 1 minute, sorted, each labelled with its Round and "Game k of n" in
  that Round. Then one more, "Season over", 6 h after the last start.
- Pure moves: `nextGame`, `previousGame`, `nextRound` (first position of the
  next Round), `previousRound` (first position of this Round, or of the
  previous Round if already there), `roundStart(round)`, and
  `startingPosition` (the first position of Round 12, `DEMO_START_ROUND`).

### The visitor: `visitor-store.ts`

- `DEMO_VISITOR = { userId: "demo-visitor", displayName: "You", avatarUrl: null }`,
  with `joinedAt` = the snapshot's persona `joinedAt`.
- One `localStorage` key per Season, `hot-shots:demo:2026`, holding
  `{ position: number; tips: AllTipsRow[] }`. `read()` returns a result: a
  missing, corrupt or wrong-shaped value gives `ok: false` and the caller
  starts fresh. Wrap every access in `try/catch`, since `localStorage` can
  throw in private windows.
- `saveTip`, `clearAll`, `savePosition`.

### Demo services

- `squiggleServiceDemo` satisfies the same type as `squiggleService`:
  - `getAllCurrentTeams`: the snapshot's teams.
  - `getGames(round?)`: the snapshot's Games, filtered by Round, mapped
    through `gameAsOf(g, now())`.
  - `getIncompleteGames`: the masked Season, `!isComplete`, sorted as in `api.ts`.
  - `getModelTips(round)`: the snapshot's Model tips for that Round.
  - `getStandings`: `standingsAsOf`.
- `aflServiceDemo` satisfies the same type as `aflService`. Each method takes
  the same `{ data }` argument the server functions take. Tipsters = the
  snapshot's personas plus `DEMO_VISITOR`. Tips = the snapshot's plus the
  visitor's. Games = the masked Season.
  - `submitTip`: `judgeTip` with `now()`. On `ok: false`, throw the same error
    `tips.ts` throws. On success, `saveTip` with `is_underdog` and
    `created_at = new Date(now()).toISOString()`; return `{ success: true }`.
  - `getTips`, `getLeaderboard`, `getGroupTips`, `getPlayerStats`: the
    matching `competition.ts` function with `now()`.
- In `service-registry.ts`, replace `typeof squiggleService` /
  `typeof aflService` with named types (`SquiggleService`, `AflService`)
  describing what callers use, so the Demo services can be checked against
  them with `satisfies`. If the server-function call types make that awkward,
  derive the types from the real services (`typeof service`) and make the
  Demo services match those. Don't loosen any type to `any`.

### Wiring the Demo in

- `router.tsx`: `if (IS_DEMO)` register the Demo services (not
  `tipsRepository`), skip `persistQueryClient` entirely, and call
  `setDemoNow(visitor position ?? startingPosition)` before the router is
  created. Else, exactly today's code.
- `start.ts`: `requestMiddleware: IS_DEMO ? [] : [clerkMiddleware()]`.
- `__root.tsx`: render `<ClerkProvider>` only when `!IS_DEMO`.
- `_authenticated.tsx`: `ssr: !IS_DEMO`. In the Demo, `beforeLoad` returns
  `{ userId: DEMO_VISITOR.userId }` without calling the server function.
- `/sign-in`, `/sign-in/$`, `/sign-up`: in the Demo, `beforeLoad` redirects
  to `/afl-tipping/tips`.
- `use-current-user.ts`: `type CurrentUser = { id: string; displayName: string; imageUrl: string | null }`.
  Pick the implementation when the module loads, so hooks run in the same
  order on every render:
  `export const useCurrentUser = IS_DEMO ? useDemoVisitor : useClerkCurrentUser;`
  `useClerkCurrentUser` maps Clerk's user. Its display name is `fullName`,
  falling back to the primary email, as `header.tsx` does today, and its
  image is `hasImage ? imageUrl : null`. It returns `undefined` while
  signed out. Move the 4 call sites to it.
- `header.tsx`: in the Demo, don't render `UserButton`.
- `DemoTimeControl`: rendered by the AFL Tipping layout route
  (`routes/_authenticated/afl-tipping.tsx`) when `IS_DEMO`. Add bottom padding
  to the page so the bar never covers content.

### `DemoTimeControl`

- Layout: one slim bar fixed to the bottom of the screen.
  - Left: the position, e.g. "Round 12 · before Game 3 of 9 · Thu 11 Jun, 7:40pm".
  - Underneath it, in muted text: "Demo: the other Tipsters are made up. Your Tips stay in this browser."
  - Right: ⏮ previous Round, ◀ previous Game, a Round picker, ▶ next Game,
    ⏭ next Round, and **Reset demo**.
  - On a phone the buttons stay in one row and the explanatory text can
    truncate.
- Every move: `setDemoNow(at)`, `savePosition(at)`, then
  `queryClient.invalidateQueries({ queryKey: aflQueries.aflKey() })`.
- **Reset demo**: a confirmation dialog in the app (shadcn `alert-dialog`;
  add it with `npx shadcn@latest add alert-dialog` if it's missing, never
  `window.confirm`). Then `clearAll()`, move to `startingPosition`, and
  invalidate.
- Accessible names on every icon button. Disable the moves at either end.
  Announce the new position in an `aria-live="polite"` region.

## Commands you will need

| Purpose                 | Command                                                 | Expected on success                    |
| ----------------------- | ------------------------------------------------------- | -------------------------------------- |
| Typecheck               | `npm run typecheck`                                     | exit 0                                 |
| Tests                   | `npm run test:ci`                                       | all pass                               |
| Build (production)      | `npm run build`                                         | exit 0                                 |
| Build (Demo)            | `npx cross-env VITE_DEMO=true npm run build`            | exit 0, with no Clerk/Supabase env set |
| Lint + format           | `npm run check`                                         | exit 0                                 |
| Run the Demo            | `npm run dev:demo` (added in Step 6)                    | AFL Tipping opens with the bar         |
| Regenerate the snapshot | `npx tsx scripts/snapshot-demo-season.ts --season 2026` | writes `season-2026.json`              |
| Storybook               | `npm run storybook`                                     | `DemoTimeControl` stories render       |

## Scope

**In scope**: everything in "Module layout", plus:

- `src/features/afl-tipping/api/tips.ts` (Step 1), `utils/afl-game.ts`,
  `hooks/use-game-start-timer.ts`
- `src/features/afl-tipping/api/squiggle/api.ts`, `squiggle/constants.ts`
  (User-Agent constant only)
- `src/app/service-registry.ts`, `src/app/router.tsx`, `src/app/start.ts`
- `src/routes/__root.tsx`, `src/routes/_authenticated.tsx`,
  `src/routes/_authenticated/afl-tipping.tsx`, `src/routes/sign-in.tsx`,
  `src/routes/sign-in.$.tsx`, `src/routes/sign-up.tsx`
- `src/components/header.tsx`, and the three `useUser` call sites in
  `afl-tipping/components/`
- `src/components/ui/alert-dialog.tsx` (only if it has to be added)
- `package.json` / `package-lock.json`: `tsx` in `devDependencies`, a
  `dev:demo` script
- `.env.example`, `AGENTS.md`, `GLOSSARY.md`, ✚ `docs/adr/0004-…`, delete
  `DEMO_MODE_PLAN.md`, `README.md` (the demo link only), `plans/README.md`

**Out of scope** (do NOT touch):

- Scoring behaviour. Step 1 is a move: every server function returns exactly
  what it returns today.
- The production Vercel project, Clerk, Supabase, and the repo's visibility
  (plan 011).
- Live scores, a ticking Demo clock, Demo-only names or icons, per-visitor
  accounts.
- `DevLoginButtons` and the `VITE_DEV_USER_*` variables.

## Git workflow

- Branch: `advisor/010-public-demo-site`.
- One commit per step. Scopes per AGENTS.md: `afl-tipping` for most of it,
  `auth` for `use-current-user` and the sign-in routes' redirect (or
  `routes`), `app` for `src/app/` and `src/lib/`, `build` for `package.json`,
  `repo` for docs and plans. Example:
  `afl-tipping: move the leaderboard and group tips rules out of tips.ts`.
- Do NOT push or open a PR unless the operator says so.

## Steps

### Step 1: Move `tips.ts`'s rules into `competition.ts`

Pin the current behaviour first, then move it:

1. Write `competition.test.ts` against the functions **as they are today**:
   copy each private helper into `competition.ts` unchanged and export it, so
   the tests pin today's behaviour. Cover:
   - Leaderboard order, including ties on Score broken by lowest Margin
     difference, and Tipsters with no Tips.
   - The Margin difference for a right and a wrong team.
   - A Draw counting as wrong.
   - Auto-tips merged for Games after `joinedAt` only, and never counted as
     Underdog tips.
   - Group Tips hiding other Tipsters' teams and Margins before Lockout.
   - Untipped entries.
   - `judgeTip`: rejects after Lockout, and `isUnderdog` is `undefined`
     without a Model tip.
   - The player-stats entry sort.
2. Add the five functions from Design on top, make `tips.ts` call them, and
   delete the moved code from `tips.ts`. Add `hasStarted(game, at = now())`
   with `now` from a new `src/lib/clock.ts`. For now it only needs `now()`;
   Step 4 adds the store.
3. Delete `plans/002-scoring-compliance-tests.md` and its row in
   `plans/README.md` (it's already marked superseded there): this step did
   its work.

**Verify**: `npm run typecheck && npm run test:ci && npm run build`. Then
`npm run dev`, sign in with a dev user, and compare the tips, group-tips and
stats pages with production for the same Round: they must be identical.

### Step 2: Snapshot script and seeded Tipsters

1. Extract `SQUIGGLE_USER_AGENT`, `npm i -D tsx`.
2. Confirm Squiggle returns the Ladder as at a Round:
   `curl -s -A "<SQUIGGLE_USER_AGENT>" "https://api.squiggle.com.au/?q=standings;year=2026;round=10"`
   should differ from `round=23`. If `round` is ignored, STOP.
3. Write `seed-tips.ts` + `seed-tips.test.ts`. The tests check that:
   - The same input gives the same output.
   - There are no Tips on skipped Games.
   - A Margin is set only on Margin games.
   - `is_underdog` follows the Model tip.
   - The low-quota persona misses `MINIMUM_UNDERDOGS_PER_ROUND` in at least
     one non-Finals Round.
   - Each persona's accuracy over the Season is within ±10 points of its
     `accuracy`.
4. Write `scripts/snapshot-demo-season.ts`. It takes `--season`, fetches
   teams, Games, Model tips (`source=1`) and the Ladder after every Round,
   parses them with the existing schemas to check them, runs `seedTips`, and
   writes `DemoSnapshot` as formatted JSON. It makes one request per
   resource, with a short pause between the per-Round Ladder requests.
5. Run it for 2026 and commit `season-2026.json`. Report its size; anything
   over ~1 MB is worth a note.

**Verify**: `npm run test:ci`. Look over the generated Leaderboard by hand: a
quick script or test that runs `buildLeaderboard` on the snapshot at the
Season's end should show a spread of Scores and no two personas identical.

### Step 3: Season as of a moment, and the positions

Write `snapshot.ts`, `season-as-of.ts` and `demo-positions.ts`, each with a
`*.test.ts`. The tests check that:

- A started Game is unchanged, and a later Game has every result field reset.
- `getActiveRound` over a masked Season is the first Round after `at`.
- `standingsAsOf` returns zeroed records before Round 1 is complete and the
  right Round's Ladder afterwards.
- Positions are sorted and collapse Games with equal start times.
- `nextRound` and `previousRound` behave at both ends, and `startingPosition`
  is before Round 12's first Game.
- `loadSnapshot` rejects a corrupted snapshot with `ok: false`.

**Verify**: `npm run test:ci`.

### Step 4: The Demo clock, the visitor and the Demo services

1. Complete `src/lib/clock.ts` (the store), add `src/lib/demo.ts`, and write
   `useDemoClock`. Fix `use-game-start-timer.ts` per Design, and test both
   paths: a Demo clock past the start returns `true` with no timers; on the
   real clock, the timeout re-checks before locking.
2. Write `visitor-store.ts` + test, including corrupt and missing storage.
3. Write both Demo services and give the registry named service types. In
   `afl.service.demo.test.ts`, with a small fixture snapshot, check that:
   - `submitTip` saves a Tip and rejects one after Lockout.
   - Moving the clock back before a Game unlocks the visitor's Tip on it.
   - Moving past an untipped Game gives the visitor an Auto-tip, which
     disappears once they tip the Game at an earlier position.
   - The Leaderboard includes "You".
   - Other Tipsters' Tips on unstarted Games stay hidden.

**Verify**: `npm run typecheck && npm run test:ci`.

### Step 5: Run without Clerk in the Demo

Write `use-current-user.ts` and move the 4 call sites. Make the `start.ts`,
`__root.tsx`, `_authenticated.tsx`, sign-in/sign-up and `header.tsx` changes
from Design. Update the existing component tests that mock
`@clerk/tanstack-react-start` for `useUser`, so they mock
`~/features/auth/use-current-user` instead.

**Verify**: `npm run typecheck && npm run test:ci && npm run build`. The
production build still signs in, guards AFL Tipping, and shows the user's
name and avatar menu (`npm run dev`, check by hand).

### Step 6: Wire the Demo and add the Time control

1. Register the Demo services and skip cache persistence in `router.tsx`.
   Add `"dev:demo": "cross-env VITE_DEMO=true vp dev"` to `package.json`.
2. Build `DemoTimeControl` + `demo-time-control.stories.tsx` (positions near
   the start, mid-season, and at "Season over"; use `containerDecorator`) +
   `demo-time-control.test.tsx`. The test checks that each button moves the
   clock and invalidates `["afl"]`, that the ends are disabled, and that
   Reset asks for confirmation before clearing. Render it from the AFL
   Tipping layout route.

**Verify**: `npm run dev:demo` with an empty `.env` (no Clerk or Supabase
keys), in a private window:

- `/` shows the Hub. AFL Tipping opens on Round 12 with every Game tippable,
  and `/sign-in` redirects into AFL Tipping.
- Tip some Games, step forward past them, and see results and Scores update.
  Skipped Games show as Auto-tips.
- Step back: your Tips unlock, and the Auto-tips disappear after tipping.
- Group Tips show other Tipsters' Tips only after Lockout.
- Stats and the Ladder follow the clock.
- Reload: you're at the same position with the same Tips. Reset returns to
  Round 12 with no Tips.
- The browser console shows no hydration errors.

### Step 7: Prove production is unchanged

1. `npm run build`, then `grep -rl "demo-visitor\|season-2026" .output/`:
   expect nothing.
2. `npx cross-env VITE_DEMO=true npm run build`: expect exit 0 with no Clerk
   or Supabase variables set. If anything demands them, STOP.

### Step 8: Docs

- `docs/adr/0004-the-demo-runs-in-the-browser.md`: the decision and the two
  alternatives it beat. The first is the localStorage, no-Clerk, no-seed
  design in `DEMO_MODE_PLAN.md`: an empty Competition and no time travel.
  The second is a separate deployment with its own Clerk and Supabase: a
  shared database can't let each visitor sit at a different point in the
  Season, and it needs a seed and reset job against a live database. Record
  the accepted simplifications: started means finished, Underdog tips are
  judged against the final Model tip, and auth and RLS aren't exercised in
  the Demo.
- `GLOSSARY.md`, under "The site":
  - **Demo**: The public copy of the site, where a visitor plays through a
    past Season in their own browser against made-up Tipsters.
    _Avoid_: sandbox, staging, preview (Vercel's preview deployments are
    something else).
  - **Demo clock**: The moment in that Season the Demo is showing. The Time
    control moves it.
    _Avoid_: simulated date, time machine.
- `AGENTS.md`, under "Apps on this site": one line saying `VITE_DEMO=true`
  builds the Demo, and that new data must reach components through the
  service registry or the Demo won't have it (`docs/adr/0004`).
- `.env.example`: `# VITE_DEMO=true builds the Demo (docs/adr/0004). Leave unset.`
- Delete `DEMO_MODE_PLAN.md`.

**Verify**: `npm run check`.

### Step 9: OPERATOR — create the Demo's Vercel project

Give the operator this checklist:

1. Vercel → Add New → Project → import the same GitHub repo. Name it
   `hot-shots-demo`, so its address is `hot-shots-demo.vercel.app`; a custom
   subdomain can come later.
2. Environment variables, Production only: `VITE_DEMO=true`. Nothing else.
3. Deploy, then repeat Step 6's checks on the deployed URL from a phone.

Then add a **Live demo** link at the top of `README.md` (if plan 011 has
rewritten it; otherwise tell the operator to add it to 011's README), and
update this plan's row in `plans/README.md`.

## Test plan

New tests:

- Unit (`*.test.ts`): `competition`, `seed-tips`, `season-as-of`,
  `demo-positions`, `snapshot`, `visitor-store`, `afl.service.demo`,
  `use-game-start-timer`.
- Component (`*.test.tsx`): `demo-time-control`.
- A `DemoTimeControl` story.

Existing tests keep passing. The ones that mocked Clerk's `useUser` move to
mocking `useCurrentUser` (Step 5); note each one changed in the report.

## Done criteria

ALL must hold:

- [ ] `typecheck`, `test:ci`, `build`, `check` exit 0; the Demo build exits 0 with no secrets
- [ ] `tips.ts` handlers only fetch and call `competition.ts`; server outputs unchanged
- [ ] No component calls Clerk's `useUser` directly
- [ ] The production build contains no Demo code or snapshot (Step 7)
- [ ] Every Step 6 check passes on the deployed Demo
- [ ] ADR 0004, glossary terms, AGENTS.md line, `.env.example` done; `DEMO_MODE_PLAN.md` deleted
- [ ] Plan 002 deleted with its row; this plan's row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 changes what any server function returns. A test pinned on today's
  behaviour fails after the move, or the pages differ from production.
- Squiggle's standings query ignores `round` (Step 2).
- `ssr: false` on `_authenticated` isn't supported by the installed TanStack
  Start, or the Demo still renders AFL pages on the server.
- The Demo build or dev server demands Clerk or Supabase variables after
  Step 5.
- Making the Demo work needs component changes beyond the listed `useUser`
  call sites, the header, and the layout route. That means something reaches
  data outside the service registry; report where.
- The production bundle contains the snapshot or the Demo services.

## Maintenance notes

- **Moving the Demo to a newer Season**: run the snapshot script with
  `--season <year>`, commit the new JSON, and point `snapshot.ts` at it.
  Visitors' saved Tips are keyed by Season, so old ones are ignored rather
  than mixed in. Check that `DEMO_START_ROUND` is still mid-season.
- **New features must go through the service registry** or the Demo won't
  have their data. AGENTS.md says so after Step 8.
- The Demo has no server-side state, so there's nothing to reset, rotate or
  keep alive. If Vercel's free tier ever matters, the Demo project could be
  removed and redeployed in minutes.
