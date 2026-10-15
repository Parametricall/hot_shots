# Underdog prediction-change indicator on the tips page

## Context

When a user submits a tip, `submitTip` (`src/features/afl-tipping/api/tips.ts:88-93`) snapshots `is_underdog = teamId !== modelTip.tipTeamId` into the `afl_tipping` table. This frozen snapshot is deliberate — it records that the user _consciously_ chose an underdog — and drives the "minimum 2 underdogs per round" rule (`src/features/afl-tipping/api/player-stats.ts`) and the `UnderdogWarning` banner.

However, the game card (`src/features/afl-tipping/components/game-card.tsx:200-201`) labels teams "Favourite"/"Underdog" from the **live** Squiggle prediction. When the model flips after a tip is placed, the user sees their pick labelled "Underdog" while the rule counts it as a favourite (and vice versa) — confusing and looks like a bug.

**Fix:** a display-only amber badge on the tipped team showing what the tip is _locked as_ whenever the snapshot disagrees with the live prediction, plus a hint that re-tapping the team refreshes the snapshot (since `submitTip` recomputes it on every save).

### Agreed UX decisions (confirmed with user)

1. Compact amber badge on the tipped team's button: "Counts as Favourite" / "Counts as Underdog".
2. Shown **only on mismatch** (no badge on agreement, legacy tips with `isUnderdog` undefined, or missing prediction).
3. Includes re-tip hint ("Tap again to update") while the game hasn't started.
4. Badge **stays visible after game start** (even though confidence labels disappear); hint disappears once locked.

## Out of scope — must NOT change

- `submitTip` / snapshot formula (`src/features/afl-tipping/api/tips.ts`), `tips.repository.ts`
- `player-stats.ts` underdog counting / `game-rules.ts` / leaderboard scoring
- `underdog-warning.tsx` banner
- `AflUserTip` / `AflModelTip` types (already carry everything needed)
- `games-list.tsx` (props already plumbed), existing `confidenceLabel` / `displayValue` logic
- No Supabase schema changes, no new tooltip component

## Step 1 — Pure helper `getTipSnapshotMismatch`

**File:** `src/features/afl-tipping/utils/afl-tipping.ts` (existing pure-utils module; add `AflUserTip`, `AflModelTip` to its type imports from `../types`).

```ts
export type TipSnapshotStatus = "favourite" | "underdog";

export function getTipSnapshotMismatch(
  tip: AflUserTip | undefined,
  prediction: AflModelTip | undefined,
): TipSnapshotStatus | null;
```

Semantics (mirrors the snapshot formula in `tips.ts:90`):

1. `tip == null` → `null`
2. `tip.isUnderdog == null` → `null` (legacy tips saved before the column existed)
3. `prediction == null` or `prediction.tipTeamId == null` → `null` (`AflModelTip.tipTeamId` is `number | null` in `types.ts` — the check is required)
4. `liveIsUnderdog = tip.tipTeamId !== prediction.tipTeamId`
5. `tip.isUnderdog === liveIsUnderdog` → `null` (agreement)
6. Else return **the stored status**: `tip.isUnderdog ? "underdog" : "favourite"`

Notes:

- Use `prediction.tipTeamId`, **not** `confidence >= 50` — `submitTip` snapshots against `tipTeamId`, so it's the source of truth for what "counts". Do not change the existing `confidenceLabel` logic.
- Finals: no special-casing. The snapshot is still recorded and counted in `season.totalUnderdogs`, so the badge stays accurate. (Round-minimum waiver for finals lives in `player-stats.ts` and is untouched.)

## Step 2 — `game-card.tsx` changes

**No new public props.** `GameCardTeamButton` (line 181) already gets `game`, `prediction`, `tip` from `useGameCard()` context and computes `isGameStarted`, `isComplete`, `isLocked`, `isSelected` (lines 183-187). `GameCardSimple` inherits the behaviour for free.

### 2a. New private component (near `TipStateIndicator`, ~line 127)

```tsx
function LockedTipStatusBadge({
  status,
  showRetipHint,
}: {
  status: TipSnapshotStatus;
  showRetipHint: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 px-1.5 py-0 text-[10px] font-medium"
      >
        <AlertTriangle />
        Counts as {status === "underdog" ? "Underdog" : "Favourite"}
      </Badge>
      {showRetipHint && <span className="text-[9px] text-amber-700">Tap again to update</span>}
    </div>
  );
}
```

- Imports: `Badge` from `~/components/ui/badge`; add `AlertTriangle` to the existing lucide import (line 14); add `getTipSnapshotMismatch` to the existing `~/features/afl-tipping/utils/afl-tipping` import (line 19).
- Amber palette matches `underdog-warning.tsx` (`border-amber-300 bg-amber-50 text-amber-800`). `Badge` auto-sizes the svg icon (`[&>svg]:size-3`).
- `Badge` renders a `span` — safe inside the team `<Button>` (no nested interactive element). Clicks bubble to the button's `onClick`, which **is** the re-tip action.

### 2b. Wire into `GameCardTeamButton`

After line 189 (`tippedIncorrectly`):

```ts
const lockedStatus = isSelected ? getTipSnapshotMismatch(tip, prediction) : null;
```

Render in **both** responsive value columns, after the `showLoading` ternary closes (so it isn't hidden by the skeleton branch), directly beneath the existing confidence label:

- Mobile block (`sm:hidden`, lines 247-259): before `</div>` add
  `{lockedStatus && <LockedTipStatusBadge status={lockedStatus} showRetipHint={!isLocked} />}`
- Desktop block (`hidden sm:flex`, lines 260-272): same line, same position.

Behaviour falls out automatically:

- **Before start:** live confidence label shows; badge beneath it on mismatch; `!isLocked` → hint shows.
- **After start:** `confidenceLabel` is `null` (its `!isGameStarted` guard) and `displayValue` becomes the score, but `lockedStatus` has no `isGameStarted` dependency → badge persists; `showRetipHint` false → hint gone.
- Badge only renders on the selected team's button (`isSelected` gate), so a tip on a non-participating team shows nothing.

### 2c. Untouched in this file

`TipStateIndicator`, margin input, stats accordion, `confidenceLabel`, `displayValue`, shadow styling, `GameCardTBD`.

## Step 3 — Tests

### 3a. Helper units — extend `src/features/afl-tipping/utils/afl-tipping.test.ts`

New `describe("getTipSnapshotMismatch")`, inline `AflUserTip`/`AflModelTip` literals:

1. Stored favourite (`isUnderdog: false`, `tipTeamId: 1`), model now tips team 2 → `"favourite"`
2. Stored underdog (`isUnderdog: true`, `tipTeamId: 1`), model now tips team 1 → `"underdog"`
3. Agreement both ways → `null`
4. `isUnderdog: undefined` (legacy) → `null`
5. `tip` undefined → `null`
6. `prediction` undefined → `null`
7. `prediction.tipTeamId: null` → `null`

### 3b. Component tests — new `src/features/afl-tipping/components/game-card.test.tsx`

Follow `games-list.test.tsx` setup: `vi.mock("/dummy-footy-logo.png?url", ...)`, `vi.mock("~/app/service-registry", ...)`, `renderWithClient` from `~/test/render`, factories from `~/features/afl-tipping/mocks/factories`. No fake timers — `useGameStartTimer` seeds synchronously from `Date.now()`, so `game.unixTime` past/future controls started state.

Badge text renders twice (mobile + desktop blocks) → use `getAllByText` / `queryByText`:

1. Fav→dog flip: tip `{ tipTeamId: 1, isUnderdog: false }` + prediction `tipTeamId: 2` → "Counts as Favourite" ×2, hint present
2. Dog→fav flip: tip `{ tipTeamId: 1, isUnderdog: true }` + prediction `tipTeamId: 1` → "Counts as Underdog"
3. Agreement → no "Counts as" text
4. Legacy tip (no `isUnderdog`) + mismatching prediction → no badge
5. No prediction → no badge
6. Game started (`unixTime` in past) + mismatch → badge present, hint absent, plain "Favourite"/"Underdog" labels absent
7. Badge is inside the tipped team's button (`closest("button")` contains team name)

### 3c. Existing suites unchanged

`player-stats.test.ts`, `game-rules.test.ts`, `use-tip-mutation.test.tsx`, `games-list.test.tsx` must pass without edits — if they need changes, scope has drifted.

## Step 4 — Storybook — extend `src/features/afl-tipping/components/game-card.stories.tsx`

Reuse existing `currentGame`, `inProgressGame`, mock services, and inline prediction objects:

1. `LockedAsFavouriteMismatch` — tip `{ gameId: 100, tipTeamId: 1, isUnderdog: false }`, prediction `tipTeamId: 2, homeConfidence: 40, awayConfidence: 60`; `play` asserts badge + hint (mirror the `PredictionLoading` play pattern)
2. `LockedAsUnderdogMismatch` — tip `{ gameId: 100, tipTeamId: 1, isUnderdog: true }`, prediction `tipTeamId: 1, homeConfidence: 65`
3. `MismatchAfterGameStart` — `game: inProgressGame`, mismatching tip/prediction → badge with scores, no hint, no confidence labels
4. `MismatchMobile` — `containerDecorator("max-w-[360px]")` to confirm the badge fits the narrow column (shorten copy only if it overflows)

## Step 5 — Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run storybook` — visually check the four new stories, especially `MismatchMobile` for overflow
- End-to-end sanity via `npm run dev`: on My Tips, a tip whose stored `isUnderdog` disagrees with the current model tip shows the amber badge; tapping the team again clears it (snapshot refreshed); badge persists on started games

## Suggested sequencing

1. Helper + unit tests
2. `LockedTipStatusBadge` + wiring in `game-card.tsx`
3. `game-card.test.tsx`
4. Stories
5. Full verification, `npm run format` on new files
