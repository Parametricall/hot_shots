# The Demo runs in the visitor's browser, over a committed snapshot of a past Season

The public Demo is the 2026 Season played out in the visitor's own browser against made-up
Tipsters. It is the same code as production, built with `VITE_DEMO=true`, and deployed as a
second Vercel project with no secrets. It has no Supabase and no Clerk: the visitor is a fixed
Tipster, "You", and their Tips live in `localStorage`. A Time control, a bar at the bottom of every
AFL Tipping page, moves the Demo clock Game by Game, so the visitor can tip, watch results come in,
see Auto-tips land on Games they skipped, and watch the Leaderboard change.

The seam is the service registry (`src/app/service-registry.ts`). The Demo registers
`squiggleServiceDemo` and `aflServiceDemo` in place of the real services, so queries and
components don't change. Both read a snapshot of the Season (Squiggle's raw responses and the
made-up Tipsters' Tips, `src/features/afl-tipping/demo/season-2026.json`, written by
`scripts/snapshot-demo-season.ts`) that is loaded on demand and never reaches a production bundle.
Every rule the server functions apply (Lockout, Auto-tips, the Leaderboard, Group Tips, player
stats) lives in pure functions in `api/competition.ts`, which the server functions and
`aflServiceDemo` both call, so the Demo can't drift from production's rules. The Demo clock
(`src/lib/clock.ts`) is read wherever a rule asks what time it is.

## Considered options

| Option                                                                                 | Why not                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localStorage`, no Clerk, no seed, real Squiggle (the first plan, `DEMO_MODE_PLAN.md`) | The Competition starts empty, so the Leaderboard and Group Tips show nothing, and the Demo shows nothing worth seeing from October to March when no Game is open. Nothing to tip against, and no way to see results |
| A separate deployment with its own Clerk and Supabase                                  | One database shared by every visitor can't let each of them stand at a different point in the Season. It also needs a seed job and a reset job against a live database, and a second set of secrets to look after   |
| The browser-only Demo over a snapshot                                                  | Chosen: nothing server-side to reset, rotate or keep alive, and each visitor controls their own clock                                                                                                               |

## Consequences

- **Accepted simplifications.** In the Demo a Game that has "started" is finished: the snapshot
  only has final scores, so every position of the Demo clock is just before a Game starts. An
  Underdog tip is judged against the Model's final tip for the Game, since that is all the snapshot
  has. Auth and RLS (`docs/adr/0002`) are not exercised: the Demo has neither.
- **New features must reach components through the service registry**, or the Demo won't have
  their data. A server function called directly from a component works in production and breaks
  in the Demo.
- **Gate Demo-only imports with `import.meta.env.VITE_DEMO === "true"` written out** where the
  import is, not with `IS_DEMO` from `src/lib/demo.ts`. Vite folds the literal where it stands, so
  the dead branch and its import disappear before bundling. A constant imported from another
  module is folded only after the bundler has chunked, so the Demo code would still be emitted for
  production. After touching a gate, build for production and check that
  `grep -rlE "demo-visitor|season-2026" .output` finds nothing in `.js` or `.mjs` files.
- **The snapshot is Squiggle's data, as of a date.** Moving the Demo to a newer Season means
  running `npx tsx scripts/snapshot-demo-season.ts --season <year>`, committing the new file,
  pointing `DEMO_SEASON` and the import in `snapshot.ts` at it, and checking that
  `DEMO_START_ROUND` is still mid-season. Visitors' saved state is keyed by Season, so an older
  save is ignored rather than mixed in.
- **The Hub and the app manifests are unchanged**, so installing the Demo installs "Hot Shots",
  as production does.
