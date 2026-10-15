# Plan 004: Live game-score updates via Squiggle's SSE (Event) API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 612bab8..HEAD -- src/features/afl-tipping src/app src/routes vite.config.ts`
> If `src/features/afl-tipping/api/queries.ts`, `src/app/service-registry.ts`,
> `src/app/router.tsx`, or `src/features/afl-tipping/components/tipping-page-shell.tsx`
> changed since this plan was written, re-read them and reconcile before
> proceeding. In particular, plan 005 (remove server-side caching) may land
> first — it touches `squiggle.serverfns.ts`, which this plan does NOT touch,
> so the two are compatible in either order.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (005 is independent; either order works)
- **Category**: feature / realtime
- **Planned at**: commit `612bab8`, 2026-07-04

## Why this matters

During a live game the app shows stale scores. `hooks/use-game-start-timer.ts`
only flips a `hasStarted` boolean so the UI switches from confidence-% to
score display — but the score itself comes from the `allGames()` query
(`staleTime: Infinity`) and never refreshes mid-game. Squiggle provides a
purpose-built SSE Event API for exactly this; using it makes scores, the game
clock (`timeStr`), and completion state tick live on the game cards with no
polling.

## Current state (research already done — trust this, do not re-derive)

### Squiggle SSE API (verified live with curl on 2026-07-04 + official docs)

- Host: `https://sse.squiggle.com.au` (separate from REST `https://api.squiggle.com.au`).
- Channels:
  - `/games` (also `/games/<team_id>`): on connect a `games` event (array of all
    in-progress or within-6h games), then `addGame` / `removeGame` events.
  - `/events` (also `/events/<game_id>`): on join a `game` snapshot event per
    live game, then `score`, `timestr`, `complete` events, and `winner` + final
    `game` on conclusion.
  - `/test`: emits mock data every ~10s — use for plumbing verification anytime.
- Game payload fields: `id`, `year`, `round`, `hteam`, `ateam`, `date`,
  `complete` (int 0–100), `winner`, `hscore`, `ascore`, `hgoals`, `hbehinds`,
  `agoals`, `abehinds`, `venue`, `timestr`, `updated`, `is_final`,
  `is_grand_final`. Score event: `gameid`, `type` ("goal"/"behind"), `side`,
  `team`, `complete`, `timestr`, and an aggregate score object.
- Stream sends `retry:2000` and per-message `id:` lines.
- Etiquette: User-Agent must identify the app + contact email (REST layer
  already sends `"Alex's Tipping App - parametricall@users.noreply.github.com"`
  inline in `squiggle/api.ts:14`); clients must auto-reconnect (their server
  restarts occasionally); no one-shot fetches against the Event API.
- **CORS: origin allowlist.** `Origin: http://localhost:3000` → 200 with
  `Access-Control-Allow-Origin` echoed (direct browser EventSource works in
  dev). Arbitrary production origins (tested two, incl. a `*.vercel.app`
  domain) → **403 Forbidden**. Requests with NO Origin header (server-to-
  server) → 200.

### Decisions (made with the operator; do not relitigate)

1. **Transport: proxy the stream through our own TanStack Start server route**
   (`/api/live-scores`). Direct browser EventSource is broken in prod by the
   allowlist. _Recorded alternative_: email Squiggle to allowlist the prod
   domain, then drop the proxy — a future simplification, not this plan.
2. **Scope: update only existing `AflGame` fields** — `homeScore`, `awayScore`,
   `timeStr`, `complete`, `winnerTeamId`. No goals/behinds type extension.
3. **Channel: `/events` (all games).** It is the only channel emitting
   `score`/`timestr`/`complete`/`winner`; one connection covers overlapping
   games; the on-join `game` snapshots double as the initial sync. Only
   `?channel=events|test` is whitelisted on the proxy — never an arbitrary path.

### Codebase facts

- REST integration: `src/features/afl-tipping/api/squiggle/{api,schemas,constants}.ts`;
  `squiggleGameDtoToDomain` maps to `AflGame` (`types.ts:33-49`). `AflGame.date`
  is a `Date` — the localStorage query persister (`src/app/router.tsx`) has a
  Date-reviving deserializer, so cache writes must preserve `Date` instances.
- Service registry (mandatory per CLAUDE.md): register in
  `src/app/service-registry.ts` (`ServiceTypes` interface) and wire in
  `src/app/router.tsx` (~lines 18–24). Tests `vi.mock` the registry; Storybook
  injects via `parameters.services` + `withServices`.
- Query keys (`api/queries.ts`): `allGames` → `["afl","games"]` (staleTime
  Infinity), `games(round)` → `["afl","games",{round}]`, `incompleteGames` →
  `["afl","games","incompleteGames"]`. All hold `AflGame[]`. QueryClient
  defaults: staleTime 60s, `refetchOnWindowFocus: "always"`, localStorage
  persist 24h with `invalidateQueries()` after restore.
- Score UI: `components/game-card.tsx` renders `homeScore`/`awayScore`,
  `timeStr`, and a live margin once started; fed by `games-list.tsx` via
  `useSuspenseQuery(aflQueries.allGames())`. `tipping-page-shell.tsx` is the
  stable ancestor that already calls `useSuspenseQuery(aflQueries.allGames())`.
- Helpers: `utils/afl-game.ts` has `hasStarted`, `isComplete`; no `isLive` yet.
- Server routes: `@tanstack/react-start` **1.168.2** supports the unified API —
  `createFileRoute("/api/...")({ server: { handlers: { GET } } })` (verified in
  `node_modules/@tanstack/start-client-core/dist/esm/serverRoute.d.ts`). Clerk's
  `auth()` works in handlers because `clerkMiddleware()` is a global request
  middleware in `src/app/start.ts`.
- No EventSource/WebSocket/SSE/refetchInterval code exists anywhere yet.
- Vercel: streaming responses supported (Fluid Compute). Deployment preset is
  auto-detected by the `nitro` vite plugin (`nitro-nightly`); no vercel.json.

## Commands you will need

| Purpose              | Command                                                                                                                 | Expected on success                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Upstream smoke       | `curl -N -H "User-Agent: Alex's Tipping App - parametricall@users.noreply.github.com" https://sse.squiggle.com.au/test` | `retry:2000` then a random event every ~10s |
| Live payload capture | same, against `.../events` during a live game                                                                           | `game`/`score`/`timestr`/`complete` events  |
| Typecheck            | `npm run typecheck`                                                                                                     | exit 0                                      |
| Tests                | `npm run test:ci`                                                                                                       | all pass                                    |
| Build                | `npm run build`                                                                                                         | exit 0                                      |
| Lint / format        | `npm run lint` / `npm run format`                                                                                       | exit 0                                      |
| Dev server           | `npm run dev`                                                                                                           | port 3000                                   |

## Scope

**In scope** (new files marked ✚):

- ✚ `src/routes/api/live-scores.ts` — SSE proxy server route
- ✚ `src/features/afl-tipping/api/live-scores.service.ts` — EventSource service
- ✚ `src/features/afl-tipping/api/squiggle/sse-schemas.ts` (+ ✚ test) — Zod SSE event schemas
- ✚ `src/features/afl-tipping/utils/live-game-update.ts` (+ ✚ test) — pure merge + cache writer
- ✚ `src/features/afl-tipping/hooks/use-live-scores.ts` (+ ✚ test) — lifecycle hook
- `src/features/afl-tipping/api/squiggle/constants.ts` — add `SQUIGGLE_SSE_HOST`, extract `SQUIGGLE_USER_AGENT`
- `src/features/afl-tipping/api/squiggle/api.ts` — use the extracted UA constant
- `src/features/afl-tipping/utils/afl-game.ts` — add `isLive` / `isLiveOrImminent`
- `src/features/afl-tipping/constants.ts` — add `LIVE_PRE_GAME_WINDOW_MS`
- `src/app/service-registry.ts`, `src/app/router.tsx` — register `liveScoresService`
- `src/features/afl-tipping/components/tipping-page-shell.tsx` — mount the hook
- `vite.config.ts` — nitro/Vercel `maxDuration` for the streaming route (Step 6)
- `src/routeTree.gen.ts` — regenerated automatically; commit the regen

**Out of scope** (do NOT touch):

- `squiggle.serverfns.ts` and `api/cache.ts` — plan 005's territory. Build
  nothing that depends on the server-side `withCache`.
- No UI changes: `game-card.tsx`, `games-list.tsx` etc. already render live
  fields. No new components, no goals/behinds on `AflGame`.
- No polling fallback, no `/games` channel handling (`addGame`/`removeGame`
  ignored), no per-game `/events/<id>` connections, no BroadcastChannel
  multi-tab dedupe (noted as future work).

## Git workflow

- Branch: `advisor/004-squiggle-sse-live-updates`
- Incremental commits per step are fine; final subject e.g.
  `Add live score updates via Squiggle SSE proxied through /api/live-scores`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Pin the real SSE payload shapes

The exact `data:` shapes of `score`/`timestr`/`complete`/`winner` events on the
all-games `/events` channel are not fully documented. Before writing schemas:

1. Run the upstream smoke curl (`/test`) to confirm connectivity and observe
   the wire format (`event:` / `id:` / `data:` lines).
2. If a game is live (season runs Thu–Sun), capture `/events` output to a file
   and record, per event name: top-level `gameid` placement, the aggregate
   score object's keys (`hscore`/`ascore`?), and whether `game` snapshots carry
   `winnerteamid` or only `winner` (a name string).
3. Turn captures into fixture constants in `sse-schemas.test.ts`.

If no live game is available, proceed with the documented shapes below,
parse leniently (Step 2 handles unknowns safely), and leave a `TODO(sse-pin)`
comment; the snapshots + resync mechanism make wrong guesses non-fatal.

**Verify**: `/test` curl streams events; captured fixtures (or the TODO) exist.

### Step 1: Constants

In `src/features/afl-tipping/api/squiggle/constants.ts` add:

```ts
export const SQUIGGLE_SSE_HOST = "https://sse.squiggle.com.au";
export const SQUIGGLE_USER_AGENT = "Alex's Tipping App - parametricall@users.noreply.github.com";
```

Replace the inline UA string in `squiggle/api.ts:14` with the constant. In
`src/features/afl-tipping/constants.ts` add
`export const LIVE_PRE_GAME_WINDOW_MS = 1000 * 60 * 30;` (30 min — enough to
catch the first bounce without holding idle connections; Squiggle's own window
is 6h, deliberately not copied).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Zod SSE schemas + parser

New `src/features/afl-tipping/api/squiggle/sse-schemas.ts`:

```ts
export type LiveGameUpdate = { gameId: number } & Partial<
  Pick<AflGame, "homeScore" | "awayScore" | "timeStr" | "complete" | "winnerTeamId">
>;

export function parseSseEvent(eventName: string, rawData: string): LiveGameUpdate | null;
```

- One `z.looseObject` schema per event name (`game`, `score`, `timestr`,
  `complete`, `winner`) so extra/unknown fields never fail parsing. Documented
  starting shapes (adjust per Step 0 pins):
  - `game` snapshot: `{ id, hscore, ascore, timestr?, complete, winnerteamid? }`
    → full 5-field update (this is the connect-time sync).
  - `score`: `{ gameid, complete?, timestr?, score?: { hscore, ascore } }`
  - `timestr`: `{ gameid, timestr }` · `complete`: `{ gameid, complete }` ·
    `winner`: `{ gameid, winnerteamid? }`
- `JSON.parse` in try/catch + `safeParse`; any failure → return `null` and
  `console.warn` **once per event name** (module-level `Set<string>`). A
  malformed Squiggle event must never throw into the app.
- Unknown event names → `null` silently.
- If SSE turns out not to carry `winnerteamid`, omit `winnerTeamId` here — the
  merge layer (Step 4) derives it at `complete === 100`.

New `sse-schemas.test.ts`: fixtures parse to expected updates; unknown event
name → null; malformed JSON → null without throwing; warn fires once per name.

**Verify**: `npm run test -- sse-schemas` → pass; typecheck clean.

### Step 3: `isLive` helpers

In `src/features/afl-tipping/utils/afl-game.ts` (alongside `hasStarted` /
`isComplete`, matching their style):

```ts
export const isLive = (game: AflGame) => hasStarted(game) && !isComplete(game);
export const isLiveOrImminent = (game: AflGame, nowMs = Date.now()) =>
  !isComplete(game) && game.unixTime - nowMs <= LIVE_PRE_GAME_WINDOW_MS;
```

**Verify**: typecheck clean (unit coverage lands with the hook tests in Step 7).

### Step 4: Pure merge logic + cache writer

New `src/features/afl-tipping/utils/live-game-update.ts`:

```ts
// Pure. Returns the SAME array reference when nothing changed (structural
// sharing keeps select/memo results stable and avoids spurious re-renders).
export function applyLiveGameUpdate(games: AflGame[], update: LiveGameUpdate): AflGame[];

// Writes one update into every games-shaped query cache.
export function writeLiveGameUpdateToCache(queryClient: QueryClient, update: LiveGameUpdate): void;
```

`applyLiveGameUpdate` rules:

- Game id not found, or every provided field already equal → return the input
  array unchanged (`===`).
- Otherwise return a new array where ONLY the matched game is
  `{ ...game, ...changedFields }` — all other elements keep identity; the
  updated game's `date: Date` instance carries over by reference (only the 5
  scalar fields are ever touched — persister Date invariant holds).
- Winner fallback: if the update lands `complete: 100` without a
  `winnerTeamId`, derive it from final scores vs `homeTeamId`/`awayTeamId`
  (`null` on a draw).

`writeLiveGameUpdateToCache`:

- `queryClient.getQueriesData<AflGame[]>({ queryKey: ["afl","games"] })` — the
  prefix matches `allGames`, every `games(round)`, and `incompleteGames`.
- Per entry: skip non-arrays; `setQueryData` only when
  `applyLiveGameUpdate` returned a different reference.
- `gameStats` lives under a different key and recomputes from games via
  `select` — intentionally untouched.

New `live-game-update.test.ts` (pure, use `createAflGame` factories from
`~/features/afl-tipping/mocks/factories`): identity preserved for untouched
elements and no-op updates (`toBe`); `date` instance preserved; winner
derivation incl. draw; cache writer updates all three seeded games caches,
leaves a decoy `["afl","teams"]` cache untouched, skips unchanged caches.

**Verify**: `npm run test -- live-game-update` → pass.

### Step 5: SSE proxy server route

New `src/routes/api/live-scores.ts` using the unified server-route API:

```ts
export const Route = createFileRoute("/api/live-scores")({
  server: { handlers: { GET: handler } },
});
```

Handler behavior, in order:

1. **Auth**: `const { userId } = await auth();` → 401 if null. EventSource
   sends same-origin cookies by default, so the Clerk session flows; this
   closes the open-proxy hole.
2. **Channel**: `?channel=` from `new URL(request.url).searchParams`, default
   `"events"`; anything outside `{"events","test"}` → 400.
3. **Upstream**: `fetch(\`${SQUIGGLE_SSE_HOST}/${channel}\`, { headers:
   { "User-Agent": SQUIGGLE_USER_AGENT, Accept: "text/event-stream" },
   signal: request.signal })`—`request.signal`cancels upstream when the
   client disconnects.`!upstream.ok || !upstream.body` → 502.
4. **Pump with heartbeat** (extract as a named function for testability):
   manual `reader.read()` loop enqueueing chunks unmodified (Squiggle's
   `retry:2000` and `id:` lines pass through), plus a `setInterval` enqueueing
   `:hb\n\n` every 25s (prevents idle-timeout kills between scoring events);
   upstream done/error → clear interval, close controller (browser
   auto-reconnects); `cancel()` → clear interval, `reader.cancel()`.
5. **Response headers**: `content-type: text/event-stream; charset=utf-8`,
   `cache-control: no-cache, no-transform`, `x-accel-buffering: no`.

**Verify**: `npm run dev`; sign in in the browser; in devtools console
`const es = new EventSource("/api/live-scores?channel=test"); es.addEventListener("message", console.log)`
→ an event every ~10s. `curl -i -N http://localhost:3000/api/live-scores` (no
cookies) → 401. Typecheck passes (confirms route typing + `routeTree.gen`
regen).

### Step 6: Vercel maxDuration for the streaming route

Configure a generous `maxDuration` (e.g. 300s; up to 800s on Pro Fluid
Compute) for this function via the nitro plugin in `vite.config.ts`. The exact
key must be checked against the installed `nitro-nightly` (likely
`vercel.functions.maxDuration` or a `routeRules` entry scoped to
`/api/live-scores`). When the cap cuts the stream, the browser EventSource
reconnects and the hook resyncs (Step 7) — by design.

**Verify**: `npm run build` → exit 0 and the `.output` Vercel config reflects
the duration setting (inspect `.output/**/config.json` or preset output).

### Step 7: `liveScoresService` + registry wiring

New `src/features/afl-tipping/api/live-scores.service.ts`:

```ts
export type LiveScoresSubscription = {
  onUpdate: (update: LiveGameUpdate) => void;
  onResync: () => void; // reconnect-after-error → missed events possible
};
export const service = { subscribe(sub: LiveScoresSubscription): () => void };
```

- SSR guard: `typeof window === "undefined" || typeof EventSource === "undefined"`
  → no-op unsubscribe.
- **Ref-counted singleton EventSource** on `/api/live-scores?channel=events`:
  first subscriber opens it, later ones share, last unsubscribe → `close()`.
- Named SSE events do NOT hit `onmessage` — register `addEventListener` for
  each of `game`, `score`, `timestr`, `complete`, `winner`; each handler runs
  `parseSseEvent` and fans out non-null updates to all subscribers.
- Reconnect detection: `onerror` sets a flag (EventSource auto-reconnects via
  the passed-through `retry:2000`); the next `onopen` with the flag set clears
  it and fans out `onResync`. Terminal statuses (e.g. 401) stop EventSource
  reconnection — acceptable; the hook re-subscribes on its next lifecycle flip.

Register: add `liveScoresService` to `ServiceTypes` in
`src/app/service-registry.ts` and `registerService(...)` in `src/app/router.tsx`
alongside the existing registrations (module only holds functions — SSR-safe
to import).

Optional cheap test: stub `globalThis.EventSource` with a fake recording
listeners; assert ref-counting (2 subscribes → 1 construction; 2 unsubscribes
→ `close()`), listener registration per event name, error→open → `onResync`.

**Verify**: `npm run test:ci` still green; typecheck clean.

### Step 8: `useLiveScores` hook + mount

New `src/features/afl-tipping/hooks/use-live-scores.ts`:

```ts
export function useLiveScores(games: AflGame[]): void;
```

- `shouldConnect = games.some((g) => isLiveOrImminent(g, now))`, with `now`
  re-evaluated on a 60s interval (mirror `use-game-start-timer.ts`'s
  `GAME_STATUS_CHECK_INTERVAL_MS` pattern) so the connection opens when a start
  time passes without a re-render. Skip the interval entirely when no
  incomplete game starts within the next 24h.
- Effect on `[shouldConnect, queryClient]`: when true,
  `serviceRegistry.getService("liveScoresService").subscribe({`
  `onUpdate: (u) => writeLiveGameUpdateToCache(queryClient, u),`
  `onResync: () => queryClient.invalidateQueries({ queryKey: ["afl","games"] })`
  `})`; return the unsubscribe as cleanup.
- Shutdown is emergent: last game hits `complete: 100` → cache write
  re-renders caller → `shouldConnect` flips → cleanup unsubscribes → ref count
  0 → EventSource closes. Initial sync needs no REST call (`game` snapshots on
  join); `onResync` invalidation is the safety net for reconnect gaps — and
  the only refresh path for `allGames` given `staleTime: Infinity`.

Mount once in `components/tipping-page-shell.tsx`, immediately after its
existing `const { data: games } = useSuspenseQuery(aflQueries.allGames());`:
`useLiveScores(games);`. Do NOT mount per-card or in `games-list.tsx`.

New `use-live-scores.test.tsx` (`vi.mock("~/app/service-registry")`, fake
service capturing handlers + `vi.fn()` unsubscribe, `renderWithClient` or hook
render under a seeded `createTestQueryClient()`, `vi.useFakeTimers`):

- No subscribe when no game is live/imminent.
- Subscribes when one is; a game starting in 10 min + advancing 60s ticks
  crosses the pre-game window and triggers subscribe.
- Captured `onUpdate` mutates the seeded caches; `onResync` invalidates
  `["afl","games"]`.
- Unmount → unsubscribe called; completing the last game via `onUpdate`
  (`complete: 100`) → unsubscribe called.

**Verify**: `npm run test -- use-live-scores` → pass; full `npm run test:ci`
green; `npm run typecheck`, `npm run lint`, `npm run build` → exit 0;
`npm run format` before committing new files.

## Test plan

Summarized from steps: `sse-schemas.test.ts` (parser + fixtures),
`live-game-update.test.ts` (pure merge + cache writer), `use-live-scores.test.tsx`
(lifecycle), optional fake-EventSource service test. The proxy route is
verified manually (Step 5/Verification) — streaming + Clerk make a unit test
low-value; the extracted pump function MAY get a unit test (heartbeat
injection + cancel propagation with fake ReadableStreams) if cheap. No
Storybook story — no new UI surface; existing `game-card` stories already
cover started-game rendering.

## Verification (end-to-end)

1. Gates: `npm run typecheck`, `npm run test:ci`, `npm run build`, `npm run lint` — all exit 0.
2. Upstream: `/test` curl streams.
3. Dev proxy: devtools EventSource on `?channel=test` streams; unauthenticated
   curl → 401; killing the dev server mid-stream → browser retries (network
   tab) and, once back, a games refetch fires (resync path).
4. During a real live game: open `/afl-tipping/tips`; `/api/live-scores`
   appears as a pending eventsource request; scores/`timeStr` on game cards
   update without refresh; after the final siren the connection closes within
   a minute (ref count drop).
5. Vercel preview deploy: stream works on the nitro preset; watch function
   duration in the dashboard; confirm the `maxDuration` cut reconnects
   silently and scores stay correct after resync.

## Done criteria

ALL must hold:

- [ ] All four gates exit 0 (`typecheck`, `test:ci`, `build`, `lint`)
- [ ] New unit tests exist and pass: sse-schemas, live-game-update, use-live-scores
- [ ] Dev-server proxy check passes (`?channel=test` streams; anon curl → 401)
- [ ] `liveScoresService` registered via the service registry (CLAUDE.md pattern) — no direct EventSource use in components/hooks
- [ ] Cache writes preserve `Date` instances and array identity on no-ops (asserted in tests)
- [ ] `squiggle.serverfns.ts` / `api/cache.ts` untouched (`git diff --stat`)
- [ ] Live-game e2e observed (or explicitly recorded as pending-next-game-day in the report + README row)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Squiggle's SSE host 403s/blocks the **server-side** proxy fetch (no-Origin
  requests were verified working at planning time — if this regressed, the
  transport decision needs revisiting, possibly the "email Squiggle" path).
- The unified `server.handlers` route API does not work on the installed
  TanStack Start / nitro-nightly combination (streaming response buffered or
  handler never invoked) after reasonable config attempts — do not downgrade
  or fork the router; report.
- Live `/events` payloads differ so much from the documented shapes that the
  5 in-scope fields cannot be populated (e.g. no per-event `gameid`) — capture
  the real payloads in the report.
- Vercel preview buffers or refuses the streaming response regardless of
  config — the feature would silently not work in prod; report before merging.
- You find yourself wanting to modify `game-card.tsx`/`games-list.tsx` beyond
  the shell mount — scope creep; the UI is explicitly out of scope.

## Maintenance notes

- **Future simplification**: ask Squiggle (contact per their site) to
  allowlist the production domain; then the service can point EventSource
  straight at `sse.squiggle.com.au/events` and the proxy route + maxDuration
  config can be deleted. Keep the service interface unchanged so this is a
  one-file swap.
- Multi-tab users hold one connection per tab; a BroadcastChannel-based
  leader-tab dedupe is a known future option, not needed at current user
  counts.
- If Vercel streaming costs surprise, tighten `LIVE_PRE_GAME_WINDOW_MS` or
  lower `maxDuration` (reconnect churn is cheap; resync covers gaps).
- Plan 005 removes the server-side `withCache`; nothing here depends on it.
