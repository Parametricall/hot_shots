# Plan 009: Give Tipsters a home-team Auto-tip for every Game they miss

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat b9f6b9b..HEAD -- src/features/afl-tipping/api/tips.ts src/features/afl-tipping/api/tips.repository.ts src/features/afl-tipping/api/player-stats.ts src/features/afl-tipping/types.ts src/features/afl-tipping/components/game-card.tsx src/features/afl-tipping/components/group-tips-list.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 008 edits `leaderboard.tsx`,
> `queries.ts` and the service registry, not these files, so it doesn't count
> as drift.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes every Tipster's Score, retroactively)
- **Depends on**: none
- **Category**: direction (new game rule)
- **Planned at**: commit `b9f6b9b`, 2026-10-15

## Why this matters

Today a Game a Tipster forgets to tip scores nothing, so one forgotten Round can
knock a Tipster out of contention. The owner has decided that a missed tip
becomes an **Auto-tip on the Home team**, recorded in
`docs/adr/0001-missed-tips-become-home-team-auto-tips.md`. The code doesn't do
this yet: the Leaderboard, the stats page, the Player Tips page and My Tips all
treat a missed Game as untipped.

Owner decisions made when planning (2026-10-15):

- **Retroactive.** Auto-tips apply to every Game in the data, including the
  finished 2026 season. The current Leaderboard and stats **will change**; that
  is intended.
- **Computed on read.** Auto-tips are never stored. Whenever tips are read for
  scoring or display, the missing ones are filled in. No cron job, no new
  column, no backfill.

## Current state

### The rule, from `GLOSSARY.md` and the ADR (use these terms in names and comments)

> **Auto-tip**: The Tip a Tipster gets for a Game they hadn't tipped by Lockout:
> the Home team. Only Games whose Lockout comes after the Tipster joined get
> one. It counts like any other Tip, except that it is never an Underdog tip,
> and it is shown as an Auto-tip wherever Tips are shown.
>
> **Lockout**: The moment a game starts.
>
> **Margin**: … A Tip without one, Auto-tips included, has a Margin of 0.

Turned into rules for this plan:

1. A Tipster gets an Auto-tip for a Game when **all** hold: the Game has started
   (`now >= game.unixTime`); the Game has a home team (`game.homeTeamId != null`);
   the Tipster joined before the Game started (`joinedAt < game.unixTime`); and
   the Tipster has no stored tip for that Game.
2. The Auto-tip picks `game.homeTeamId`, has no Margin (`margin: null`, which
   every scorer already treats as 0) and no underdog status
   (`is_underdog: null`), so it never counts toward the Underdog quota.
3. Otherwise it is a normal Tip: it counts for Correct tips, the Score, the
   Margin difference, Perfect rounds, Streaks and Accuracy.
4. **"Joined"** is the Tipster's Clerk account creation time
   (`user.createdAt`, epoch milliseconds, on Clerk's backend `User` object).
   `game.unixTime` is also epoch milliseconds (`AflGame.hasStarted` is
   `Date.now() >= game.unixTime`, `src/features/afl-tipping/utils/afl-game.ts:5`).

### Where tips are read today (all in `src/features/afl-tipping/api/tips.ts`)

- `fetchAllClerkUsers()` (lines 35-65) returns
  `Map<userId, { displayName; avatarUrl }>` — no join date yet.
- `getLeaderboard` (197-212): `repo.getAllTips()` → `scoreTips(...)` →
  `assembleLeaderboard(userMap, userStats)`. Every Clerk user is on the
  Leaderboard, tipped or not.
- `getPlayerStats` (297-326): `repo.getAllTips()` → `computePlayerStats(allTips, games)`
  (in `player-stats.ts`).
- `getGroupTips` (274-295): `repo.getTipsByGameIds(gameIds)` →
  `buildTippedEntries` (218-240) + `buildUntippedEntries` (242-272). An untipped
  Tipster becomes `{ hasTipped: false, tipTeamId: null }`.
- `getTips` (105-114): the signed-in Tipster's own tips for some `gameIds`, via
  `getTipsByUser` → `AflUserTip[]`. Feeds My Tips (`game-card.tsx`).

Row type, `src/features/afl-tipping/api/tips.repository.ts:11-18`:

```ts
export interface AllTipsRow {
  game_id: number;
  user_id: string;
  tip: number;
  margin: number | null;
  is_underdog: boolean | null;
  created_at: string;
}
```

(`getAllTips` doesn't actually select `created_at`; nothing reads it there.)

Scoring already treats a missing Margin as 0 (`tip.margin ?? 0` at
`tips.ts:162` and `player-stats.ts:154`) and only counts underdogs where
`is_underdog === true` (`player-stats.ts:137`). So an Auto-tip row shaped as in
rule 2 is scored correctly with **no changes to `scoreTips` or
`computePlayerStats`**.

### Display

- `src/features/afl-tipping/types.ts`: `AflUserTip` (`gameId`, `tipTeamId`,
  `margin?`, `isUnderdog?`) and `AflGroupTipEntry` (`userId`, …, `hasTipped`,
  `tipTeamId`, `margin?`, `hasMargin?`) have no Auto-tip flag.
- `group-tips-list.tsx`: `UserBadge` (lines 21-56) renders a Tipster's name, the
  Margin, or "! no margin". After Lockout, `PostGameTips` groups tipped entries
  by team.
- `game-card.tsx`: `GameCardTipStatusNotice` (281-301) is an amber strip under
  the matchup, rendered by `GameCardMatchup` (319). It is the model for an
  Auto-tip notice.
- `group-tips-list.tsx:229-240` refetches group tips when a Game's Lockout
  passes:
  ```tsx
  const hasStarted = useGameStartTimer(game.unixTime);
  const queryClient = useQueryClient();
  const prevHasStarted = useRef(hasStarted);
  useEffect(() => {
    if (hasStarted && !prevHasStarted.current) {
      queryClient.invalidateQueries({ queryKey: aflQueries.allGroupTipsKey() });
    }
    prevHasStarted.current = hasStarted;
  }, [hasStarted, queryClient]);
  ```
  My Tips has no equivalent, so without one an Auto-tip only shows there after
  the tips query's 5-minute stale time.

### Conventions

- Pure logic lives in dependency-free modules next to the server fns, tested in
  Node: `player-stats.ts` + `player-stats.test.ts` are the model (factories
  from `~/features/afl-tipping/mocks/factories`, test APIs from `vite-plus/test`).
- New types use `type` aliases, not `interface` (`AGENTS.md`).
- Commit messages are scope-first, no `feat:`/`fix:`, imperative, ≤72 chars,
  "why" in the body. Example: `afl-tipping: fill missed tips with home-team auto-tips`.

## Commands you will need

| Purpose   | Command                                                         | Expected on success                 |
| --------- | --------------------------------------------------------------- | ----------------------------------- |
| Typecheck | `npm run typecheck`                                             | exit 0, no errors                   |
| One file  | `npx vp test run src/features/afl-tipping/api/auto-tips.test.ts` | all pass                            |
| Tests     | `npm run test:ci`                                               | exit 0, all tests pass              |
| Lint+fmt  | `npm run check`                                                 | exit 0 ("pass" for format and lint) |
| Build     | `npm run build`                                                 | exit 0                              |

## Suggested executor toolkit

- `tdd` skill (in `.claude/skills/`): write Step 1's tests first.

## Scope

**In scope** (the only files you should modify or create):

- `src/features/afl-tipping/api/auto-tips.ts` (create)
- `src/features/afl-tipping/api/auto-tips.test.ts` (create)
- `src/features/afl-tipping/api/tips.ts`
- `src/features/afl-tipping/api/tips.repository.ts` (add one optional field to `AllTipsRow`)
- `src/features/afl-tipping/api/player-stats.test.ts` (add cases)
- `src/features/afl-tipping/types.ts`
- `src/features/afl-tipping/components/group-tips-list.tsx` and `group-tips-list.test.tsx`
- `src/features/afl-tipping/components/game-card.tsx` and `game-card.test.tsx`
- `src/features/afl-tipping/mocks/factories.ts` (only if a factory needs the new flag)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- `scoreTips`, `assembleLeaderboard` (in `tips.ts`) and `player-stats.ts` — they must keep scoring exactly as now; Auto-tips arrive as ordinary rows.
- The Supabase schema and `afl_tipping` rows — Auto-tips are never written.
- `submitTip` and `use-tip-mutation.ts` — a Tipster can't tip after Lockout, and Auto-tips only exist after Lockout.
- `underdog-warning.tsx` — Auto-tips have no underdog status, so it already ignores them.
- `GameRules` in `game-rules.ts` — no rule changes there; the Margin default stays 0.

## Git workflow

- Branch: `auto-tips`.
- One commit per step (or per two small steps), scope `afl-tipping`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the Auto-tip rule as a pure function, test-first

Create `src/features/afl-tipping/api/auto-tips.test.ts` first (cases in the Test
plan), then `src/features/afl-tipping/api/auto-tips.ts`:

```ts
import * as AflGame from "~/features/afl-tipping/utils/afl-game";

export type AutoTip = { gameId: number; userId: string; tipTeamId: number };

/**
 * The Auto-tips owed for `games`: one per Tipster per started Game they joined
 * before and haven't tipped, on the Home team (docs/adr/0001).
 */
export function findAutoTips(args: {
  games: AflGame.Type[];
  tips: { game_id: number; user_id: string }[];
  joinedAtByTipster: Map<string, number>; // userId → joined-at, epoch ms
  now: number; // epoch ms; pass Date.now() in production
}): AutoTip[];
```

Implement rule 1 and rule 2 from Current state: build a `Set` of
`` `${game_id}:${user_id}` `` keys from `tips`, then for each game with
`now >= game.unixTime` and `game.homeTeamId != null`, for each
`[userId, joinedAt]` with `joinedAt < game.unixTime` and no key, emit
`{ gameId: game.id, userId, tipTeamId: game.homeTeamId }`.

Also export a row adapter so the server fns can merge Auto-tips with stored rows:

```ts
export function toAutoTipRow(autoTip: AutoTip, game: AflGame.Type): AllTipsRow;
// → { game_id, user_id, tip: tipTeamId, margin: null, is_underdog: null,
//     is_auto_tip: true, created_at: new Date(game.unixTime).toISOString() }
```

In `tips.repository.ts`, add `is_auto_tip?: boolean;` to `AllTipsRow` (stored
rows never set it).

**Verify**: `npx vp test run src/features/afl-tipping/api/auto-tips.test.ts` → all pass.

### Step 2: Know when each Tipster joined

In `tips.ts`, extend `fetchAllClerkUsers()` so each map value also carries
`joinedAt: number` (from `user.createdAt`). Extract the value type as
`type TipsterInfo = { displayName: string; avatarUrl: string | null; joinedAt: number }`
and use it in the function signatures that take `userMap`
(`assembleLeaderboard`, `buildTippedEntries`, `buildUntippedEntries`).

Add a helper for the signed-in Tipster:

```ts
async function fetchTipsterJoinedAt(userId: string): Promise<number>
// createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! }).users.getUser(userId) → user.createdAt
```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Feed Auto-tips into scoring and stats

In `getLeaderboard` and `getPlayerStats`, after loading `allTips`, `games` and
`userMap`:

```ts
const joinedAtByTipster = new Map([...userMap].map(([id, u]) => [id, u.joinedAt]));
const gamesById = new Map(games.map((g) => [g.id, g]));
const autoTipRows = findAutoTips({ games, tips: allTips, joinedAtByTipster, now: Date.now() })
  .map((a) => toAutoTipRow(a, gamesById.get(a.gameId)!));
const tipsWithAutoTips = [...allTips, ...autoTipRows];
```

Pass `tipsWithAutoTips` where `allTips` was passed (`scoreTips(...)`,
`computePlayerStats(...)`). Fetch `userMap` before scoring if it's currently
fetched after (it is in `getLeaderboard`, line 209) — order of awaits is free to
change; use `Promise.all` for the independent fetches if convenient.

**Verify**: `npm run typecheck` → exit 0; `npm run test:ci` → exit 0.

### Step 4: Show Auto-tips on the Player Tips page

- `types.ts`: add `isAutoTip?: boolean` to `AflGroupTipEntry` and to `AflUserTip`.
- `getGroupTips`: compute Auto-tips for this round's `games` the same way
  (`joinedAtByTipster` from `userMap`) and append their rows to `allTips`
  **before** calling `buildTippedEntries` and `buildUntippedEntries`. That way an
  auto-tipped Tipster lands in the tipped list and not in the untipped one.
- `buildTippedEntries`: set `isAutoTip: tip.is_auto_tip === true` on each entry.
- `group-tips-list.tsx` `UserBadge`: when `tip.isAutoTip`, render a small muted
  marker after the name, e.g. `<span className="font-normal text-xs text-muted-foreground" title="Didn't tip: auto-tipped the home team">auto</span>`.
  For an Auto-tip on the Margin game, the badge already shows `(0pts)`; leave it.

**Verify**: `npm run test:ci` → exit 0 (with Step 6's group-tips test added).

### Step 5: Show the Tipster their own Auto-tips on My Tips

- `getTips`: alongside `getTipsByUser(userId, gameIds)`, load
  `squiggleService.getGames()` (filter to `gameIds`) and
  `fetchTipsterJoinedAt(userId)`. Run `findAutoTips` with a one-entry
  `joinedAtByTipster` map and the stored tips (map `AflUserTip.gameId` →
  `{ game_id, user_id: userId }`), and append each Auto-tip as
  `{ gameId, tipTeamId, isAutoTip: true }` (no `margin`, no `isUnderdog`).
- `game-card.tsx`: add `GameCardAutoTipNotice`, modelled on
  `GameCardTipStatusNotice` (281-301), and render it right after
  `<GameCardTipStatusNotice />` in `GameCardMatchup`. It returns `null` unless
  `tip?.isAutoTip`; otherwise a muted strip:
  `You didn't tip this game, so you were given {homeTeam.name} (the home team).`
  Use neutral styling (`border-t bg-muted text-muted-foreground`), not amber.
- `GameCardRoot`: refetch the Tipster's tips when this Game's Lockout passes,
  copying the `useGameStartTimer` + `useRef` + `useEffect` pattern from
  `group-tips-list.tsx:229-240` but invalidating `aflQueries.allGetTipsKey()`.
  Without it the Auto-tip appears only after the 5-minute stale time.

**Verify**: `npm run test:ci` → exit 0 (with Step 6's game-card tests added).

### Step 6: Full verification

**Verify**: `npm run check` → exit 0; `npm run build` → exit 0.

Then hand the operator this manual check (don't claim it yourself unless you
ran it): on `npm run dev`, a Tipster who missed a started Game sees the Auto-tip
notice on My Tips, an `auto` marker beside their name on Player Tips, and their
Score includes home-team wins from Games they missed.

## Test plan

`src/features/afl-tipping/api/auto-tips.test.ts` (model on `player-stats.test.ts`;
use `createAflGame` with explicit `unixTime`, `homeTeamId`, `awayTeamId`, and
pass `now` explicitly — no fake timers):

1. Started Game, Tipster joined before it, no stored tip → one Auto-tip on `homeTeamId`.
2. Tipster has a stored tip for the Game → no Auto-tip.
3. Game not started (`now < unixTime`) → no Auto-tip.
4. Tipster joined after the Game started (`joinedAt >= unixTime`) → no Auto-tip.
5. `homeTeamId: null` → no Auto-tip.
6. Two Tipsters, two Games, mixed → exactly the missing pairs, nothing duplicated.
7. `toAutoTipRow` → `margin: null`, `is_underdog: null`, `is_auto_tip: true`, `tip` = home team.

`src/features/afl-tipping/api/player-stats.test.ts` — add a `describe("with Auto-tips")`
feeding `computePlayerStats` stored rows plus `toAutoTipRow(...)` rows:

8. An Auto-tip on the winning home team counts as a Correct tip and in `gamesTipped`.
9. An Auto-tip never raises `underdogCount` / `totalUnderdogs`, even when the Model tipped the away team.
10. An Auto-tip on the Margin game adds the full actual margin to the Margin difference.
11. A wrong Auto-tip breaks a Streak; a right one extends it.

`group-tips-list.test.tsx` (follow its existing setup):

12. A started Game with an `isAutoTip` entry renders the `auto` marker next to that Tipster only.

`game-card.test.tsx` (follow its existing setup):

13. `tip: { gameId, tipTeamId: homeTeam.id, isAutoTip: true }` → the notice text renders.
14. A normal tip → no notice.

**Verify**: `npm run test:ci` → all pass, including the 14 new cases.

## Done criteria

- [ ] `npm run typecheck`, `npm run check`, `npm run test:ci`, `npm run build` all exit 0
- [ ] `auto-tips.ts` exists and imports nothing from `@tanstack/react-start`, `@clerk/*` or `~/app/service-registry` (`grep -n "react-start\|clerk\|service-registry" src/features/afl-tipping/api/auto-tips.ts` → no matches)
- [ ] `git diff b9f6b9b -- src/features/afl-tipping/api/player-stats.ts src/features/afl-tipping/api/game-rules.ts` → empty
- [ ] No Supabase migration added (`git status supabase` → clean)
- [ ] `git status` shows no files modified outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Clerk's backend `User` has no `createdAt`, or it isn't epoch milliseconds — the joined rule depends on it.
- `game.unixTime` turns out not to be epoch milliseconds (check `AflGame.hasStarted` and the Squiggle schema mapping) — the Lockout comparison depends on it.
- Making scoring count Auto-tips seems to need a change inside `scoreTips` or `computePlayerStats` — the design is that it doesn't; a needed change means an assumption above is wrong.
- `getGames()` in `getTips` would make My Tips noticeably slower (it's already called with the same args elsewhere and cached by TanStack Query client-side, but if the server path has no caching and a request takes >1s, report rather than add a cache).
- A test outside the new cases fails after Step 3 for a reason other than Scores now including Auto-tips.

## Maintenance notes

- **The Margin default is expected to change.** The ADR records the alternative:
  default an Auto-tip's Margin to the largest winning margin in the Round, if not
  tipping turns out to be an advantage. That change belongs in `toAutoTipRow`
  (set `margin`), and needs the Round's games — keep that function the single
  place Auto-tips get their values.
- Every reader that adds tips for a new purpose (e.g. a future export or
  history page) must go through `findAutoTips`, or Auto-tips will be missing
  there. A reviewer should check that all four server fns (`getLeaderboard`,
  `getPlayerStats`, `getGroupTips`, `getTips`) use it.
- Plan 002 (extract scoring into pure modules) touches `scoreTips` and
  `assembleLeaderboard` in `tips.ts`. If it runs after this plan, it should keep
  the Auto-tip merge in the server fns, upstream of the extracted scorers.
- Retroactive by decision: the 2026 Leaderboard changes when this deploys. Tell
  the Tipsters.
