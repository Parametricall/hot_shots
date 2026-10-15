# Plan 002: Extract the leaderboard-scoring and underdog-compliance logic into pure, unit-tested modules

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 612bab8..HEAD -- src/features/afl-tipping/api/tips.ts`
> If `tips.ts` changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `612bab8`, 2026-07-03

## Why this matters

The scoring math is the whole point of this app, and today it has **zero unit
tests**. The leaderboard ranking, the margin tiebreaker, and the underdog
compliance calculation all live as module-private functions inside
`src/features/afl-tipping/api/tips.ts`. They cannot be tested where they are:
`tips.ts` imports server-only machinery (`createServerFn` from
`@tanstack/react-start`, `createClerkClient` from `@clerk/backend`,
`serviceRegistry`), so a Node unit test cannot import it cleanly, and the
functions are not exported anyway. A wrong ranking (e.g. a broken tiebreaker or
an off-by-one in underdog counting) would ship silently — CI would stay green.

This plan moves the **pure** logic into two dependency-free modules and adds
focused unit tests. No behavior changes; it is a mechanical extraction plus
tests. It also unblocks any future change to the scoring rules by giving them a
safety net (a hard prerequisite for the caching refactor tracked separately).

## Current state

`src/features/afl-tipping/api/tips.ts` contains four module-private pure
functions used by `getLeaderboard`, plus an inline block inside
`getUnderdogCompliance`. The pure functions today (verbatim):

- `buildCompletedGameWinners(games)` — `tips.ts:115-123`: `Map<gameId, winnerTeamId|null>` for complete games.
- `buildFirstGameMargins(games)` — `tips.ts:125-137`: for each round, the actual margin of that round's earliest game.
- `scoreTips(allTips, completedGameWinners, firstGameMargins)` — `tips.ts:139-168`: per-user `{ correct, marginDiff }`.
- `assembleLeaderboard(userMap, userStats)` — `tips.ts:170-194`: builds and sorts `AflLeaderboardEntry[]` (score = correct; tiebreak = lower `totalMarginDiff`).

The compliance handler `getUnderdogCompliance` (`tips.ts:296-364`) contains an
inline aggregation: build a `gameId→round` map, a set of finals rounds (from
`game.isFinals`), per-`(user, round)` underdog counts (only for tips whose
`is_underdog` is non-null), then map every Clerk user to per-round compliance
rows where `meetsMinimum = isFinals || underdogCount >= 2`.

Types and helpers these use (all pure, no server imports):

- `import * as AflGame from "~/features/afl-tipping/utils/afl-game"` — provides
  `AflGame.Type`, `isComplete`, `groupByRound`, `getFirstGameOfRound`.
- `import { GameRules } from "~/features/afl-tipping/api/game-rules"` — provides
  `getActualMargin`, `calculateMarginDiff`, `MINIMUM_UNDERDOGS_PER_ROUND` (= 2).
- `AllTipsRow` — the DB row type, in `tips.repository.ts:11-18`:
  `{ game_id: number; user_id: string; tip: number; margin: number | null; is_underdog: boolean | null; created_at: string }`.
  Import it with `import type` so the server-only `tips.repository` module is
  never pulled in at runtime.
- Domain types from `~/features/afl-tipping/types`: `AflLeaderboardEntry`,
  `AflUnderdogComplianceEntry`.
- The Clerk user map is shaped `{ displayName: string; avatarUrl: string | null }`.

**Repo conventions to match**:

- Pure logic lives in `src/features/afl-tipping/utils/` and `.../api/` as plain
  exported functions (see `utils/afl-game.ts`, `api/game-rules.ts`).
- Unit tests are co-located `*.test.ts`, run in the Node project, and use
  `describe/it/expect` from `vitest`. **Model the new tests structurally on
  `src/features/afl-tipping/api/game-rules.test.ts`** (a local `makeGame`-style
  factory + grouped `describe` blocks).
- Game test data comes from `createAflGame` in
  `src/features/afl-tipping/mocks/factories.ts` (all fields optional via
  overrides; defaults to an incomplete future game with `homeTeamId: 1`,
  `awayTeamId: 2`).

## Commands you will need

| Purpose            | Command                                                                         | Expected on success |
| ------------------ | ------------------------------------------------------------------------------- | ------------------- |
| Install            | `npm ci`                                                                        | exit 0              |
| Typecheck          | `npm run typecheck`                                                             | exit 0, no errors   |
| All CI tests       | `npm run test:ci`                                                               | all pass            |
| Just the new tests | `npx vitest run --project=unit leaderboard-scoring underdog-compliance-scoring` | new tests pass      |
| Lint               | `npm run lint`                                                                  | exit 0              |

## Scope

**In scope** (create/modify these only):

- `src/features/afl-tipping/api/leaderboard-scoring.ts` (create)
- `src/features/afl-tipping/api/leaderboard-scoring.test.ts` (create)
- `src/features/afl-tipping/api/underdog-compliance-scoring.ts` (create)
- `src/features/afl-tipping/api/underdog-compliance-scoring.test.ts` (create)
- `src/features/afl-tipping/api/tips.ts` (modify — remove the moved code, add imports)

**Out of scope** (do NOT touch):

- `tips.repository.ts` and the other repositories.
- The server-function wiring/auth in `tips.ts` (`ensureUserAuthenticated`,
  `fetchAllClerkUsers`, the `createServerFn(...).handler(...)` wrappers) — only
  the _bodies_ that call the moved functions change.
- The group-tips builders (`buildTippedEntries`, `buildUntippedEntries`) — leave
  them where they are; they are a separate, deferred extraction (see Maintenance
  notes). Do not move them in this plan.
- Any scoring/ranking _behavior_. This is a pure move; outputs must be identical.

## Git workflow

- Branch: `advisor/002-scoring-compliance-tests`
- One commit per step is fine; short imperative subjects matching repo history
  (e.g. `Extract leaderboard scoring into a pure, tested module`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `leaderboard-scoring.ts` with the four moved functions

Create `src/features/afl-tipping/api/leaderboard-scoring.ts` with exactly this
content (this is the current logic, copied verbatim and exported, plus a shared
`UserInfo` type):

```ts
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";

export interface UserInfo {
  displayName: string;
  avatarUrl: string | null;
}

export function buildCompletedGameWinners(games: AflGame.Type[]): Map<number, number | null> {
  const winners = new Map<number, number | null>();
  for (const game of games) {
    if (AflGame.isComplete(game)) {
      winners.set(game.id, game.winnerTeamId);
    }
  }
  return winners;
}

export function buildFirstGameMargins(games: AflGame.Type[]): Map<number, number> {
  const margins = new Map<number, number>();
  const gamesByRound = AflGame.groupByRound(games);
  for (const [, roundGames] of Object.entries(gamesByRound)) {
    const firstGame = AflGame.getFirstGameOfRound(roundGames);
    if (!firstGame) continue;
    const margin = GameRules.getActualMargin(firstGame);
    if (margin !== null) {
      margins.set(firstGame.id, margin);
    }
  }
  return margins;
}

export function scoreTips(
  allTips: AllTipsRow[],
  completedGameWinners: Map<number, number | null>,
  firstGameMargins: Map<number, number>,
): Map<string, { correct: number; marginDiff: number }> {
  const userStats = new Map<string, { correct: number; marginDiff: number }>();
  for (const tip of allTips) {
    if (!userStats.has(tip.user_id)) {
      userStats.set(tip.user_id, { correct: 0, marginDiff: 0 });
    }

    const winner = completedGameWinners.get(tip.game_id);
    if (winner === undefined) continue;

    const stats = userStats.get(tip.user_id)!;
    if (tip.tip === winner) {
      stats.correct += 1;
    }

    const actualMargin = firstGameMargins.get(tip.game_id);
    if (actualMargin !== undefined) {
      stats.marginDiff += GameRules.calculateMarginDiff(
        tip.margin ?? 0,
        actualMargin,
        tip.tip === winner,
      );
    }
  }
  return userStats;
}

export function assembleLeaderboard(
  userMap: Map<string, UserInfo>,
  userStats: Map<string, { correct: number; marginDiff: number }>,
): AflLeaderboardEntry[] {
  const leaderboard: AflLeaderboardEntry[] = Array.from(userMap.entries()).map(
    ([userId, userInfo]) => {
      const stats = userStats.get(userId) ?? { correct: 0, marginDiff: 0 };
      return {
        userId,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        correctTips: stats.correct,
        totalMarginDiff: stats.marginDiff,
        score: stats.correct,
      };
    },
  );

  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalMarginDiff - b.totalMarginDiff;
  });

  return leaderboard;
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Create `underdog-compliance-scoring.ts`

Create `src/features/afl-tipping/api/underdog-compliance-scoring.ts` with exactly:

```ts
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import type { AflUnderdogComplianceEntry } from "~/features/afl-tipping/types";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import type { UserInfo } from "~/features/afl-tipping/api/leaderboard-scoring";

export function computeUnderdogCompliance(
  allTips: AllTipsRow[],
  games: AflGame.Type[],
  userMap: Map<string, UserInfo>,
): AflUnderdogComplianceEntry[] {
  // Build gameId -> round lookup
  const gameRoundMap = new Map<number, number>();
  for (const game of games) {
    gameRoundMap.set(game.id, game.round);
  }

  // Determine which rounds are finals based on the per-game isFinals flag
  const finalsRounds = new Set<number>();
  for (const game of games) {
    if (game.isFinals) {
      finalsRounds.add(game.round);
    }
  }

  // Group tips by (userId, round), only include tips with non-null is_underdog
  const userRoundStats = new Map<string, Map<number, number>>();
  const roundsWithTracking = new Set<number>();

  for (const tip of allTips) {
    if (tip.is_underdog == null) continue;

    const round = gameRoundMap.get(tip.game_id);
    if (round == null) continue;

    roundsWithTracking.add(round);

    if (!userRoundStats.has(tip.user_id)) {
      userRoundStats.set(tip.user_id, new Map());
    }
    const roundMap = userRoundStats.get(tip.user_id)!;
    const current = roundMap.get(round) ?? 0;
    roundMap.set(round, current + (tip.is_underdog ? 1 : 0));
  }

  const sortedRounds = [...roundsWithTracking].sort((a, b) => a - b);

  return Array.from(userMap.entries()).map(([userId, userInfo]) => {
    const roundMap = userRoundStats.get(userId);
    return {
      userId,
      displayName: userInfo.displayName,
      avatarUrl: userInfo.avatarUrl,
      rounds: sortedRounds.map((round) => {
        const underdogCount = roundMap?.get(round) ?? 0;
        const isFinals = finalsRounds.has(round);
        return {
          round,
          underdogCount,
          meetsMinimum: isFinals || underdogCount >= GameRules.MINIMUM_UNDERDOGS_PER_ROUND,
          isFinals,
        };
      }),
    };
  });
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Rewire `tips.ts` to import the moved functions and delete the originals

In `src/features/afl-tipping/api/tips.ts`:

1. Add these imports near the other imports at the top:

   ```ts
   import {
     buildCompletedGameWinners,
     buildFirstGameMargins,
     scoreTips,
     assembleLeaderboard,
   } from "./leaderboard-scoring";
   import { computeUnderdogCompliance } from "./underdog-compliance-scoring";
   ```

2. Delete the four now-duplicated function definitions from `tips.ts`
   (`buildCompletedGameWinners`, `buildFirstGameMargins`, `scoreTips`,
   `assembleLeaderboard` — currently around `tips.ts:115-194`). `getLeaderboard`
   already calls them by name, so it keeps working via the imports.

3. Replace the body of `getUnderdogCompliance` so the inline aggregation is
   gone and it delegates to the extracted function. The handler becomes:

   ```ts
   export const getUnderdogCompliance = createServerFn({ method: "GET" }).handler(
     async (): Promise<AflUnderdogComplianceEntry[]> => {
       await ensureUserAuthenticated();

       const repo = serviceRegistry.getService("tipsRepository");
       const allTips: AllTipsRow[] = await repo.getAllTips();

       const { getGames } = serviceRegistry.getService("squiggleService");
       const games: AflGame.Type[] = await getGames();

       const userMap = await fetchAllClerkUsers();

       return computeUnderdogCompliance(allTips, games, userMap);
     },
   );
   ```

4. If `npm run typecheck` now reports an unused import in `tips.ts` (for example
   `AflLeaderboardEntry` is only referenced by the moved `assembleLeaderboard`),
   remove that specific import from the `import type { ... } from
   "~/features/afl-tipping/types"` line. Keep `AflUnderdogComplianceEntry`,
   `AflGroupTipEntry`, and `AflUserTip` — they are still used.

**Verify**: `npm run typecheck` → exit 0. Then `npm run test:ci` → all existing
tests still pass (79 today; no fewer). Then
`grep -n "function scoreTips\|function assembleLeaderboard\|function buildFirstGameMargins\|function buildCompletedGameWinners" src/features/afl-tipping/api/tips.ts`
→ **no matches** (the originals are gone from `tips.ts`).

### Step 4: Write `leaderboard-scoring.test.ts`

Create `src/features/afl-tipping/api/leaderboard-scoring.test.ts`, structured
like `game-rules.test.ts`. Use `createAflGame` from
`~/features/afl-tipping/mocks/factories` for games, and a small local `tip()`
helper for `AllTipsRow` objects. Cover at minimum:

- **buildCompletedGameWinners**: includes only games with `complete: 100`, maps
  `id → winnerTeamId`, and preserves a `null` winner (draw). An incomplete game
  is absent from the map.
- **buildFirstGameMargins**: for a round, uses the earliest game by `unixTime`;
  returns its actual margin when that first game is complete; omits the round
  when the first game is incomplete (margin `null`).
- **scoreTips**: increments `correct` when `tip.tip === winner`; a game with no
  recorded winner (not in `completedGameWinners`) is skipped; `marginDiff` is
  added only for a game present in `firstGameMargins`; a missing `tip.margin`
  is treated as `0`.
- **assembleLeaderboard**: includes every user in `userMap` even with no stats
  (`0` correct, `0` margin); sorts by `score` descending, then by
  `totalMarginDiff` ascending as the tiebreak; `score` equals `correctTips`.

Example skeleton to follow (fill in the remaining cases):

```ts
import { describe, it, expect } from "vitest";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import {
  assembleLeaderboard,
  buildCompletedGameWinners,
  buildFirstGameMargins,
  scoreTips,
  type UserInfo,
} from "~/features/afl-tipping/api/leaderboard-scoring";

function tip(
  overrides: Partial<AllTipsRow> & { user_id: string; game_id: number; tip: number },
): AllTipsRow {
  return { margin: null, is_underdog: null, created_at: "", ...overrides };
}

const userInfo = (displayName: string): UserInfo => ({ displayName, avatarUrl: null });

describe("buildCompletedGameWinners", () => {
  it("maps only complete games to their winner", () => {
    const games = [
      createAflGame({ id: 1, complete: 100, winnerTeamId: 10 }),
      createAflGame({ id: 2, complete: 0, winnerTeamId: null }),
    ];
    const winners = buildCompletedGameWinners(games);
    expect(winners.get(1)).toBe(10);
    expect(winners.has(2)).toBe(false);
  });
});

// ...buildFirstGameMargins, scoreTips, assembleLeaderboard describes...
```

**Verify**: `npx vitest run --project=unit leaderboard-scoring` → all new tests
pass.

### Step 5: Write `underdog-compliance-scoring.test.ts`

Create `src/features/afl-tipping/api/underdog-compliance-scoring.test.ts`.
Cover at minimum:

- Tips with `is_underdog: null` are ignored entirely (round not tracked from
  them; count unaffected).
- Underdog counts aggregate per `(user, round)` — two underdog tips in the same
  round for a user → `underdogCount: 2`.
- A **finals** round (a game with `isFinals: true`) has `meetsMinimum: true`
  even with `underdogCount: 0`, and `isFinals: true`.
- A non-finals round needs `underdogCount >= 2` for `meetsMinimum: true`
  (1 underdog → `false`).
- Every user in `userMap` appears in the output, even one with no tracked tips
  (their rounds all show `underdogCount: 0`).
- Only rounds that have at least one tracked tip appear, sorted ascending.

Construct games with `createAflGame({ id, round, isFinals })` and tips with the
same `tip()` helper (set `is_underdog: true/false/null` and `game_id` to match a
game's `id`). Build the `userMap` as a `Map<string, UserInfo>`.

**Verify**: `npx vitest run --project=unit underdog-compliance-scoring` → all new
tests pass.

## Test plan

- New file `leaderboard-scoring.test.ts` — the four cases in Step 4.
- New file `underdog-compliance-scoring.test.ts` — the cases in Step 5.
- Structural pattern: `src/features/afl-tipping/api/game-rules.test.ts`.
- Full verification: `npm run test:ci` → all pass, with the new tests included
  (the total test count rises above today's 79).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:ci` exits 0; total test count is higher than before (new tests exist and pass)
- [ ] `leaderboard-scoring.ts`, `leaderboard-scoring.test.ts`, `underdog-compliance-scoring.ts`, `underdog-compliance-scoring.test.ts` all exist
- [ ] `grep -n "function scoreTips\|function assembleLeaderboard\|function buildFirstGameMargins\|function buildCompletedGameWinners" src/features/afl-tipping/api/tips.ts` returns no matches
- [ ] Only in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The four functions or the compliance block in `tips.ts` do not match the
  "Current state" description (the code drifted since this plan was written).
- Importing `leaderboard-scoring.ts` in a `*.test.ts` triggers a runtime import
  of server-only code (an error mentioning `@clerk/backend`,
  `@tanstack/react-start`, or `serviceRegistry`). This means an `import` that
  should be `import type` was written as a value import — fix that; if it
  persists, stop and report.
- After the move, `npm run test:ci` shows any **previously passing** test now
  failing (the extraction changed behavior — it must not).

## Maintenance notes

- **Deliberately deferred**: the group-tips builders (`buildTippedEntries`,
  `buildUntippedEntries` in `tips.ts`) are also pure and deserve the same
  extraction + tests. They were left out to keep this plan's diff reviewable.
  A follow-up can move them into a `group-tips-scoring.ts` using the same pattern.
- A reviewer should confirm this is a **pure move**: the bodies in the new files
  are byte-for-byte the old logic. Diff the removed `tips.ts` lines against the
  new files.
- If the scoring rules change later (e.g. score weighting, a different
  tiebreaker), update the tests in the same commit — they now exist to catch
  exactly that.
