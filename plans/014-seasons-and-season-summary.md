# Plan 014: Seasons, a Season switcher and a Season summary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. Steps marked **OPERATOR** need a decision or a
> dashboard only the operator has: stop, say exactly what is needed, and
> wait. When done, update the status row for this plan in `plans/README.md`,
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git log --oneline 8168c0b..HEAD -- src/features/afl-tipping src/routes supabase public`,
> then `git grep -n "getFullYear" -- src/features/afl-tipping/api`. The grep
> should list the three `year: new Date().getFullYear()` lines in
> `api/squiggle/api.ts` and nothing else. If either has moved on, re-check
> the "Current state" table against the code before Step 2.

## Status

- **Priority**: P1. It must be live before Opening Round 2027 (early March).
  Without it, the app flips to 2027 at midnight UTC on 1 January (see
  "Current state"). The 2026 Season then becomes unreachable, and every 2026
  Tipster joins the 2027 Leaderboard with Auto-tips whether or not they come back.
- **Effort**: L
- **Risk**: MED. One migration changes `afl_tipping`, the table that holds
  every Tip. Every route under `/afl-tipping` moves. Installed PWAs keep their
  old start URL, so the old URLs must keep working.
- **Depends on**: plan 013 Step 8 (the Supabase Auth cutover). This plan's
  migration builds on `afl_tipsters`, which only exists in production after
  that cutover.
- **Category**: feature / data model
- **Planned at**: commit `8168c0b`, 2026-11-23, from the operator's request:
  "the ability to switch between seasons, a home page for a season that shows
  the leaderboard, or at least the top 3 and the wooden spoon if it's an old
  season. It must stay easy to tip: when a season is active, the app opens
  directly to the tipping screen."

## Why this matters

Hot Shots was built for one Season. Every Squiggle call asks for
`new Date().getFullYear()`, and every Tip, Leaderboard and player stat reads
the whole `afl_tipping` table. So the app can't show last Season once a new
one starts, and it can't tell which Season a Tip belongs to except by looking
up its Game. Tipsters also want a moment of glory, and of shame, when a
Season ends: a podium and a Wooden spoon.

The tipping flow must not get slower. Opening the app during a Season must
land on My Tips in one hop, as it does now.

## The model

These terms go into `GLOSSARY.md` in Step 9. Use them in code, tests and UI copy.

- **Current Season**: the Season tipping is open for, or the newest Season
  if none is. It is the earliest Season with a Game still to finish. If no
  Season has one, it is the newest Season Squiggle has Games for.
- **Season status**: `upcoming` (no Game has started), `in-progress`, or
  `over` (every Game is complete).
- **Season summary**: the page for one Season of an App, showing the
  Leaderboard's top three and, once the Season is over, the Wooden spoon.
  _Avoid_: home page, season home, overview, dashboard. "Home" is avoided for
  the Hub already.
- **Wooden spoon**: last place on the Leaderboard of a Season that is over.
  Tipsters level on last place share it.
- **Entering a Competition** (D1): a Tipster enters a
  Season's Competition the first time they open the App while that Season is
  the Current Season and isn't over. Auto-tips start from entry, not from
  joining the App.

Where the user lands when they open `/afl-tipping`:

| Current Season status | Lands on                                    |
| --------------------- | ------------------------------------------- |
| `upcoming`            | `/afl-tipping/<season>/tips` (see D2)       |
| `in-progress`         | `/afl-tipping/<season>/tips`                |
| `over`                | `/afl-tipping/<season>`: the Season summary |

## Current state (verified at `8168c0b`)

| Where                                                 | What it does today                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/afl-tipping/api/squiggle/api.ts`        | `fetchStandings`, `fetchGames`, `fetchTips` pass `year: new Date().getFullYear()`. The server runs in UTC. `fetchIncompleteGames` passes no year.             |
| `src/features/afl-tipping/api/squiggle/schemas.ts`    | The Game DTO has `year`. The domain `AflGame` (`types.ts`) drops it.                                                                                          |
| `src/app/service-registry.ts`                         | `SquiggleService` and `AflService` have no Season parameter anywhere.                                                                                         |
| `src/features/afl-tipping/api/queries.ts`             | Keys are `["afl", "games"]`, `["afl", "leaderboard"]` and so on, with no Season in them.                                                                      |
| `src/features/afl-tipping/api/tips.ts`                | `getLeaderboard` and `getPlayerStats` read `getAllTips()`, every row ever. `submitTip` looks the Game up in this year's Games.                                |
| `src/features/afl-tipping/api/tips.repository.ts`     | `afl_tipping` has no season column. Its primary key is `(game_id, user_id)`.                                                                                  |
| `src/features/afl-tipping/api/tipsters.repository.ts` | One `afl_tipsters` row per Profile. Its `joined_at` drives Auto-tips (`docs/adr/0001`) for every Season.                                                      |
| `src/routes/_authenticated/afl-tipping/*.tsx`         | `tips`, `group-tips`, `standings`, `stats`. `index.tsx` redirects to `/afl-tipping/tips`.                                                                     |
| `src/routes/_authenticated/afl-tipping.tsx`           | The layout: the frame, the tabs (`TABS`), the Demo Time control. The `round` search param is validated here.                                                  |
| `public/site.webmanifest`                             | `"id": "/afl-tipping/tips"` and `"start_url": "/afl-tipping/tips"`.                                                                                           |
| `public/hub.webmanifest`                              | Shortcut URL `/afl-tipping/tips`.                                                                                                                             |
| Hard-coded `/afl-tipping/tips`                        | `components/header.tsx:51`, `features/hub/apps.ts:6`, `features/auth/api/session.ts:5` (`DEFAULT_REDIRECT`), `routes/sign-in.tsx:28`, `routes/sign-up.tsx:8`. |
| `src/features/afl-tipping/components/leaderboard.tsx` | Already ranks with shared ranks and draws `~/components/wooden-spoon` at the last rank.                                                                       |
| `src/features/afl-tipping/demo/`                      | The Demo plays `DEMO_SEASON = 2026` from `season-2026.json`, through the same service slots.                                                                  |

What happens today on 1 January 2027 (UTC), unchanged:

- Every page asks Squiggle for 2027. The 2026 Games, Ladder and Leaderboard
  disappear from the app.
- `buildLeaderboard` gets every 2026 Tip, but only 2027 Games. Old Tips
  don't score, because their Games aren't in the winners map. But every
  Tipster in `afl_tipsters` gets a home-team Auto-tip on every 2027 Game.
- Squiggle Game ids are unique across Seasons, so no 2026 Tip is overwritten.
  Step 2 verifies this.

## Decisions

All four are decided. The operator chose D1 and D2 on 2026-11-23. Raise one
with the operator only if a step proves it wrong.

- **D1. A Tipster enters each Season's Competition by opening the App during
  it.** This adds an `afl_competition_entries` table. A Season's Leaderboard
  only lists who entered it, and Auto-tips start at entry. It keeps ADR
  0001's "joining mid-Season doesn't backfill" rule working Season by Season.
  It needs ADR 0007.
  _Rejected_: every Tipster carries over. That needs no new table, but a
  2026 Tipster who never comes back would sit on the 2027 Leaderboard
  collecting home-team Auto-tips, and would probably "win" the Wooden spoon.
- **D2. The next Season becomes the Current Season as soon as the old one is
  over and Squiggle has the new Fixture.** The 2027 Fixture comes out in the
  off-season, so Tipsters can tip Opening Round early. Until it is out,
  opening the app shows last Season's summary.
  _Rejected_: from N days before the first Game, showing last Season's
  summary until then. It adds a constant and a branch for little gain.
  _Reversed_ on 2026-11-27 by `docs/adr/0011`: an upcoming Season lands on
  its summary until 14 days before its first Game.
- **D3. The URL carries the Season as a path segment**:
  `/afl-tipping/2027/tips`. It isn't a `?season=` search param: a Season
  scopes every page under it, the summary needs a URL of its own
  (`/afl-tipping/2026`), and search params already carry `round`.
- **D4. No Wooden spoon until a Season is over, and none for a Tipster on the
  podium.** The spoon is shown only when the last rank is greater than 3. A
  Competition of three or fewer has no spoon. Mid-Season, the summary shows
  the top three and the viewer's own rank.

## Scope

In:

- A Season parameter through Squiggle, the services, the queries, the server
  functions and the repositories.
- `afl_tipping.season` and `afl_competition_entries`.
- Routes under `/afl-tipping/$season/`, with redirects from every old URL.
- A Season switcher, a Season summary tab, and a "Back to <Current Season>"
  banner on past Seasons.
- The Demo, kept working with one Season.
- GLOSSARY, ADR 0007, `AGENTS.md`'s query-key example, and
  `docs/manual-testing.md`.

Out (list them as follow-ups in `plans/README.md` if the operator wants them):

- Season awards beyond the podium and spoon, such as most Perfect rounds or
  the Longest streak. `getPlayerStats` already has the data.
- Archiving a finished Season's results into the database. Squiggle keeps
  every past Season, so the summary is computed live, like the Leaderboard.
- A Season before 2026. `FIRST_SEASON = 2026`, and there are no Tips before it.

## Git workflow

Work on `advisor/014-seasons`. Commit per step, with the scopes from
`AGENTS.md`: `afl-tipping`, `routes`, `supabase`, `repo`. Use
`Refs: #<issue>` if the operator opens one. Run `npm run format` before each
commit.

## Steps

### Step 1: OPERATOR — decisions

Done on 2026-11-23: the operator chose D1 (enter each Season) and D2 (next
Season opens once its Fixture is out). See "Decisions".

### Step 2: Confirm Squiggle's behaviour

Make these calls with the existing `squiggleFetch` (its User-Agent), for
example from a throwaway Vitest file you don't commit, or from `vp dev` and
the network tab:

1. `q=games;year=2026` and `q=games;year=2027`. Confirm no Game id appears in
   both. This is what makes `(game_id, user_id)` still a safe primary key.
2. `q=games;complete=!100` with no year. Confirm it returns only current and
   future Games, and no stray old ones. Note whether 2027's Fixture is
   published yet.
3. `q=standings;year=2026` after the Grand Final still returns the final Ladder.

**Verify**: write the three answers into this plan's "Notes" section.
**STOP** if Game ids repeat across Seasons.

### Step 3: Pure Season rules (test-first)

Create `src/features/afl-tipping/utils/afl-season.ts`, with tests next to
it. Use `/tdd`. Nothing in it may import the service registry, the session,
or Supabase. The Demo runs it too.

```ts
export const FIRST_SEASON = 2026; // in constants.ts, next to REGULAR_SEASON_ROUNDS

export type SeasonStatus = "upcoming" | "in-progress" | "over";
export type Seasons = {
  seasons: number[]; // newest first, FIRST_SEASON..current
  current: { season: number; status: SeasonStatus; firstGameAt: number | null };
};

export function seasonStatus(games: AflGame[], now: number): SeasonStatus;

/**
 * The Current Season. `incompleteGames` is Squiggle's `complete=!100` (any
 * year). With none, it falls back to `latestSeasonWithGames`.
 */
export function resolveCurrentSeason(args: {
  incompleteGames: AflGame[];
  latestSeasonWithGames: number;
}): number;

/** Where `/afl-tipping` sends the user. */
export function landingFor(
  current: Seasons["current"],
): { to: "tips"; season: number } | { to: "summary"; season: number };

/** Ranks 1–3, ties included, or [] before any Game is complete. */
export function podium(entries: AflLeaderboardEntry[]): AflLeaderboardEntry[];

/** Everyone on the last rank, or [] when the last rank is 3 or better (D4). */
export function woodenSpoon(entries: AflLeaderboardEntry[]): AflLeaderboardEntry[];
```

Add `season: number` to the domain `AflGame` (`types.ts`), mapped from
`dto.year` in `schemas.ts`. Update `mocks/factories.ts`, whose default is 2026. The Demo snapshot keeps Squiggle's raw DTOs, so it maps the same way.

Test cases to include: a Season with the finals still running while the next
Fixture is out (the Current Season is the older one). Every rank level,
giving a podium of everyone and no spoon. Two Tipsters sharing the spoon.
Three Tipsters in all (no spoon). `upcoming` before the first bounce, `over`
when only the Grand Final is complete.

**Verify**: `npm run test:ci` passes. `npm run typecheck` will now fail where
`AflGame` is built without `season`. Fix those call sites (factories, test
fixtures) in this step.

### Step 4: Season-aware Squiggle and services

1. `api/squiggle/api.ts`: `fetchStandings(season)`, `fetchGames(season, round?)`,
   `fetchTips(season, round)` take the Season and drop `getFullYear`. Make
   the parameter required, so the compiler finds every caller. Delete
   `fetchSquiggleGame` if nothing calls it (it doesn't at `8168c0b`).
2. `api/squiggle.serverfns.ts`: validators gain `season: z.number().int().min(FIRST_SEASON)`.
   Add `getSeasonsServerFn`. It calls `fetchIncompleteGames()`, falls back to
   `fetchGames(year)` for this year and then last year (Melbourne time, not
   UTC) when none are incomplete, and returns `Seasons` using Step 3's
   functions.
3. `service-registry.ts`: `SquiggleService` becomes
   `getSeasons(): Promise<Seasons>`, `getStandings(season)`,
   `getGames(season, round?)`, `getModelTips(season, round)`. Teams stay
   Season-less: Squiggle's `q=teams` is the current 18. `AflService`'s
   `getLeaderboard`, `getPlayerStats` and `getGroupTips` take
   `{ data: { season, … } }`. `submitTip` takes `season` too, and `getTips`
   takes `{ season, gameIds }`.
4. `api/queries.ts`: put the Season into every key under one prefix, so a
   whole Season can be invalidated:

   ```ts
   seasonsKey: () => ["afl", "seasons"],          // staleTime: CACHE_DURATIONS.GAMES
   seasonKey: (season: number) => ["afl", "season", season],
   allGamesKey: (season) => [...seasonKey(season), "games"],
   // and likewise standings, modelTips, getTips, groupTips, leaderboard, playerStats, gameStats
   ```

   `teams()` keeps `["afl", "teams"]`, which `router.tsx` relies on
   (`query.queryKey[1] !== "teams"`).

5. Update every caller listed by
   `git grep -n "aflQueries\.\|getService(\"squiggleService\")" -- src`. The
   components get the Season from `useSeason()` (Step 6). Until Step 6
   lands, pass it in from the route. `use-tip-mutation.ts` invalidates
   `seasonKey(season)` sub-keys. `use-live-scores.ts` writes only into the
   Current Season's Games: live Games are always in the Current Season.
6. The Demo (`demo/squiggle.service.demo.ts`, `demo/afl.service.demo.ts`):
   `getSeasons` returns `{ seasons: [DEMO_SEASON], current: … }`, with the
   status computed at the Demo clock. Any other Season returns `[]`. The Demo
   Time control's `invalidateQueries({ queryKey: aflQueries.aflKey() })`
   stays as it is, and also refreshes `seasons`.

**Verify**: `npm run typecheck`, `npm run test:ci`, `npm run build`. The
existing tests need their query keys updated. Don't loosen any assertion to
make one pass.

### Step 5: Database and server functions

Save the production 2026 Leaderboard first. On the deployed site, open Stats,
and in the network tab save the `getLeaderboard` response as
`plans/014-leaderboard-2026-before.json`. Don't commit it: it holds names.

1. Migration `supabase/migrations/<ts>_seasons.sql`:

   ```sql
   -- One Season's Competition per row (docs/adr/0007). Auto-tips start at entered_at.
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

   alter table public.afl_tipping add column season integer;
   update public.afl_tipping set season = 2026;
   alter table public.afl_tipping
     alter column season set not null,
     add constraint afl_tipping_entry_fkey
       foreign key (user_id, season)
       references public.afl_competition_entries (profile_id, season) on delete cascade;
   create index afl_tipping_season_idx on public.afl_tipping (season);
   ```

   Before writing the `update`, confirm every existing Tip is a 2026 Game:
   the app first went live on 2026-03-31.

   RLS is on with no policies, like every table (`docs/adr/0002`).

2. `tips.repository.ts`: `saveTip` writes `season`. `getAllTips(season)`
   filters by it and keeps the paging. Convert its `interface`s to `type`s
   while you're in the file (`AGENTS.md`).
3. Add `competition-entries.repository.ts` and register it in the service
   registry and `router.tsx`. It has `enter(profileId, season): Promise<EnterResult>`
   (an upsert that keeps an existing `entered_at`, like `joinAflTipping`) and
   `getEntrants(season): Promise<TipstersResult>`, which joins `profiles` for
   names and avatars and returns `joinedAt` set to `entered_at`. Both return
   results and never throw (`AGENTS.md`).
4. `tips.ts`:
   - `ensureTipster(season)` joins the App as it does now. When `season` is
     the Current Season and it isn't over, it also enters the Tipster into
     that Season's Competition. Viewing a past Season enters nothing.
   - `submitTip` loads `getGames(season)` and `getModelTips(season, round)`.
     `judgeTip` already rejects a started Game, so past Seasons can't be
     tipped.
   - `getLeaderboard`, `getPlayerStats` and `getGroupTips` use
     `getAllTips(season)` (or `getTipsByGameIds`), `getGames(season)` and
     `getEntrants(season)` in place of `getTipsters()`.
   - The rules in `competition.ts` don't change. They already take
     `tipsters` with a `joinedAt`.

**Verify**:

- `npx supabase db reset` locally applies the migrations cleanly.
- `npm run test:ci` and `npm run build` pass.
- With `vp dev` against local Supabase, a Tip on a 2027 Game saves with
  `season = 2027`, and the Tipster has a 2027 `afl_competition_entries` row.

### Step 6: Routes

New tree under `src/routes/_authenticated/`:

```text
afl-tipping.tsx                 frame + Demo Time control (unchanged role); `round` search moves to $season
afl-tipping/index.tsx           beforeLoad: ensureQueryData(seasons) → landingFor → redirect
afl-tipping/$season.tsx         params: z.coerce.number().int().min(FIRST_SEASON); notFound() if not in seasons
                                validateSearch { round? }; tabs; Season switcher; past-Season banner
afl-tipping/$season/index.tsx   Season summary (Step 7)
afl-tipping/$season/tips.tsx    (moved, loader uses params.season)
afl-tipping/$season/group-tips.tsx
afl-tipping/$season/standings.tsx
afl-tipping/$season/stats.tsx
afl-tipping/tips.tsx            legacy: redirect to /afl-tipping/$current/tips, keeping ?round
afl-tipping/group-tips.tsx      legacy, likewise
afl-tipping/standings.tsx       legacy, likewise
afl-tipping/stats.tsx           legacy, likewise
```

- The legacy routes are permanent. iOS home-screen apps keep the
  `start_url` they were installed with, and links are already shared.
  TanStack Router ranks static segments above `$season`, so `/afl-tipping/tips`
  still matches the legacy route. Add a test that proves it.
- `useSeason()` in `src/features/afl-tipping/hooks/use-season.ts` wraps
  `getRouteApi("/_authenticated/afl-tipping/$season").useParams()` and
  returns a number. Components read the Season through it, never from props
  passed down several levels.
- `index.tsx` must not wait on the network when the cache has `seasons`. The
  persisted cache (`router.tsx`) restores it before the first render, so
  opening the installed app redirects straight to My Tips. If `seasons` fails
  to load with nothing cached, show the route's error component with a retry.
  Don't guess a Season.
- `public/site.webmanifest`: change `start_url` to `/afl-tipping`. **Leave
  `id` as `/afl-tipping/tips`.** Changing it makes installed copies a
  different app. Change the hub shortcut URL to `/afl-tipping`.
- Change every other hard-coded `/afl-tipping/tips` (see "Current state") to
  `/afl-tipping`, including `DEFAULT_REDIRECT` and its test in
  `features/auth/api/session.test.ts`, and the routes in
  `hub.stories.tsx` and `hub.test.tsx`.

**Verify**: `npm run build`, then in `vp dev`:

- `/afl-tipping` lands on My Tips for the Current Season, or on the summary
  when it is over.
- `/afl-tipping/tips?round=3` lands on `/afl-tipping/<current>/tips?round=3`.
- `/afl-tipping/1999/tips` and `/afl-tipping/abc` show Not Found.
- The back button after the redirect doesn't bounce back to `/afl-tipping`.
  Use `replace` on the redirects.

### Step 7: Season switcher, tabs and Season summary

Load the `better-interface` and `shadcn` skills before building the UI.

1. **Tabs** (`$season.tsx`): add a first tab for the Season summary. It is
   icon-only (lucide `Trophy`) with `aria-label="Season summary"`, so five
   tabs still fit at 360px. The other four stay as they are. My Tips stays
   for past Seasons as a read-only record: every Game is locked.
2. **Season switcher**: a `DropdownMenu` (`~/components/ui/dropdown-menu`)
   in the tab row, showing `2027 ▾`, with one item per Season, newest first.
   The Current Season is marked "Current". Picking a Season keeps the tab
   (`/afl-tipping/2026/stats` → `/afl-tipping/2025/stats`) and drops
   `round`. Hide the switcher while `seasons` has a single entry, which is
   true until 2027 starts and always true in the Demo.
3. **Past-Season banner**: on any Season that isn't the Current Season, show
   a slim bar under the tabs: "You're viewing 2026. Back to 2027", linking to
   the Current Season's `tips` when it is taking Tips, or to its summary when
   it is over. This keeps Tipsters from getting stuck in last Season.
4. **Season summary** (`features/afl-tipping/pages/season-summary.tsx`, with
   components in `components/season-summary/`), from `leaderboard(season)`
   and `seasons()`:
   - `upcoming`: "Opening Round starts <date>", a primary "Tip Opening Round"
     button, and "No scores yet".
   - `in-progress`: a primary "Tip Round N" button for the active Round, the
     `podium()` so far, and the viewer's own rank ("You're 7th of 15"). No
     Wooden spoon.
   - `over`: "2026 Season, final" heading, the `podium()` (Trophy, Medal and
     Award icons, as `leaderboard.tsx` uses), the `woodenSpoon()` card using
     `~/components/wooden-spoon`, the viewer's finish, and a "Full
     Leaderboard" link to `stats`.
   - Ties: every Tipster on a shared rank is shown, with "=1st" etc.
   - Loading, error with retry, and empty states, like `leaderboard.tsx`.
5. Stories next to each new component (`containerDecorator`,
   `withMockUser`, `withRouter`, factories), covering all three statuses, a
   tied podium, a shared spoon and no spoon. Component tests for the
   summary's three statuses and the switcher's navigation.

**Verify**: `npm run test:ci`, `npm run check`, `npm run storybook` (look at
every new story at mobile width), `npm run build`.

### Step 8: The Demo

`npm run dev:demo`. The Demo has one Season, 2026:

- `/afl-tipping` opens on My Tips at the start position.
- Move the Time control to "Season over", then open `/afl-tipping`. It lands
  on the 2026 summary with a podium and a Wooden spoon.
- No Season switcher shows.

**Verify**: the above by hand. `npm run test:ci` covers
`squiggle.service.demo.test.ts` and `afl.service.demo.test.ts`, which you
extended in Step 4.

### Step 9: Docs

- `GLOSSARY.md`: add Current Season, Season summary, Wooden spoon and
  Entering a Competition. Under **Competition**, replace
  "Every Tipster is in it" with "Every Tipster who has entered it". Under
  **Auto-tip**, "after the Tipster joined" becomes "after the Tipster entered
  the Competition".
- Add `docs/adr/0007-tipsters-enter-each-season.md`, recording D1 and the
  carry-over option it beat. Add a line to ADR 0001's
  Consequences pointing at it.
- `AGENTS.md`: change the query-key example to
  `["afl", "season", 2027, "games"]` and add a line: "Every AFL query below
  the Season takes the Season. Read it with `useSeason()`."
- `docs/manual-testing.md`: change the `/afl-tipping/tips` expectations, and
  add a Seasons section covering the Step 6, 7 and 8 checks, plus an
  installed-PWA launch on iOS and Android.

### Step 10: OPERATOR — release

1. Plan 013 Step 8 must be done. Check that production has `afl_tipsters`.
2. Deploy and apply the migration in the off-season, in this order: apply the
   migration, then deploy. The old code never writes a Tip in the off-season
   (every 2026 Game has started), so the `season not null` column can't break
   it.
3. Compare the 2026 Leaderboard with `plans/014-leaderboard-2026-before.json`.
   Scores, Margin differences and ranks must match exactly. Then delete the
   file.
4. On a phone with the app installed before this change, launch it. It
   should land on the Current Season.

### Step 11: Update the plans index

Set this plan's row in `plans/README.md` to DONE. Note any follow-ups the
operator chose from "Out of scope".

## Done criteria

- No `getFullYear()` left in `src/features/afl-tipping/api/`.
- Every AFL query key under a Season includes it. `git grep -n '"afl", "games"' -- src` finds nothing.
- Opening the app in-Season lands on My Tips with no extra screen and no
  extra round trip when the cache is warm.
- A finished Season's summary shows a podium and, per D4, a Wooden spoon.
- Old URLs and installed PWAs still open the app.
- The 2026 Leaderboard is unchanged by the migration.
- The Demo works and shows the summary at "Season over".
- `npm run check`, `npm run typecheck`, `npm run test:ci`, `npm run build` pass.

## STOP conditions

- Squiggle Game ids repeat across Seasons (Step 2). The primary key and the
  migration both assume they don't.
- Any existing `afl_tipping` row belongs to a Game that isn't in 2026's
  Fixture (Step 5).
- The 2026 Leaderboard changes after the migration (Step 10).
- Plan 013's cutover hasn't happened and the release window is closing.
  Tell the operator. Don't try to land this migration first.
- TanStack Router matches `/afl-tipping/tips` to `$season` instead of the
  legacy route.

## Notes

- Squiggle findings from Step 2 (run 2026-11-24, with the repo's User-Agent):
  1. `q=games;year=2026` returns 218 Games and `q=games;year=2027` returns 218 (the
     2027 Fixture is already published). No Game id appears in both (2026 ids start
     at 38494, 2027 at 40308). Game ids are unique across Seasons, so the STOP
     condition did not trigger and `(game_id, user_id)` stays a safe primary key.
  2. **Deviation**: `q=games;complete=!100` with no year is rejected. Squiggle answers
     `{"games":[{"error":"missing_parameter","message":"The 'games' query requires
     additional parameters, including at least one of 'year' or 'game'."}]}`, so
     today's `fetchIncompleteGames` fails (only `incompleteGames()` calls it). With a
     year it works: `year=2027;complete=!100` returns the 2027 Fixture, and
     `year=2028` returns `{"games":[]}`. Step 4 therefore gives `fetchIncompleteGames`
     a Season, and `getSeasons` asks for last year, this year and next year
     (Melbourne time) in parallel, then falls back to `fetchGames` for the newest
     Season with Games.
  3. `q=standings;year=2026` returns the final 2026 Ladder (18 teams, Fremantle
     first on 23 played).
- `fetchIncompleteGames` is used today only by `incompleteGames()`. It
  becomes the main input to `getSeasons`, so cache it with
  `CACHE_DURATIONS.GAMES` there, not `INCOMPLETE_GAMES`. Check what each
  duration is before choosing.
- The query cache is persisted with `buster: __BUILD_ID__`, so the key
  changes in Step 4 need no cache migration. The first launch after the
  deploy refetches.
- Executor notes (2026-11-24):
  - Step 5's "save the production 2026 Leaderboard" needs the deployed site, so it is left for
    the operator before Step 10. The migration also guards against Tips made outside 2026 by
    `created_at`; it can't check Game ids, so the "every Tip is a 2026 Game" check is still the
    operator's.
  - The migration was run against a scratch Postgres 17 container with stubbed Supabase roles and
    `auth.users` (another project's local Supabase owns the default ports here), not
    `npx supabase db reset`. A Tip for a Season with no entry is refused by the new foreign key.
  - `getSeasons` is cached for a minute per server instance, because every server function now
    calls it. `competition-entries.repository.ts` has a `getEntry` the plan didn't list, for the
    Auto-tips of a Season the Tipster hasn't entered.
  - The Season route param parses with `Number`, not zod: a parse error shows the error
    component, while an unknown Season should be Not Found.
  - `getIncompleteGames`, `incompleteGames()` and `CACHE_DURATIONS.INCOMPLETE_GAMES` are gone;
    `getSeasons` replaced them (see the Squiggle findings).
