# Implementation Plans

Open plans only. A plan is deleted once it's done and verified; what it decided lives on in
`docs/adr/`, and the plan itself in git history (`git log --diff-filter=D -- plans/`).

Plan 003 (done, deleted) came from an improve-skill audit on 2026-07-03, against commit `612bab8`;
the finding numbers below are that audit's. 004 was added by the operator on 2026-07-04, and 010
and 011 on 2026-10-17 (010 after a design review with the operator); 011 (make the repo public)
was done on 2026-10-18. 013 was added on 2026-10-21 after a conversation with the operator
(`docs/adr/0006`). 015 was added on 2026-11-25 after the operator read Squiggle's updated
API requirements, and 016 on 2026-11-27 after the operator explored an architecture page as a
private artifact. Each executor: read the plan fully before starting, honor its STOP
conditions, and update your row in the table when done.

## Status

| Plan | Title                                                                         | Priority | Effort | Risk | Depends on | Status                                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------- | -------- | ------ | ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 004  | Live game-score updates via Squiggle SSE (proxied `/api/live-scores`)         | P2       | L      | MED  | —          | IN PROGRESS (code done; live-game end-to-end and a Vercel preview check wait for a game day)                                                                                                                                                                                                                                            |
| 010  | A public, browser-only Demo with a Demo clock                                 | P1       | L      | MED  | —          | IN PROGRESS (deployed, README link added; operator: phone check, screenshots)                                                                                                                                                                                                                                                           |
| 013  | Replace Clerk with Supabase Auth                                              | P1       | L      | HIGH | —          | IN PROGRESS (cutover merged 2026-10-22; 9.2 and 9.4 done 2026-11-27: Clerk package, migration script and doc references gone; decisions: Google + emailed code, no passwords (Facebook dropped: Meta needs a verified business); left: 9.1 stragglers, 9.3 drop `profiles.clerk_user_id`, operator 9.5 Clerk keys and 9.6 iPhone check) |
| 014  | Seasons: a Season switcher, Season summary, and opening on My Tips            | P1       | L      | MED  | 013 Step 8 | IN PROGRESS (Steps 1-9 done on `advisor/014-seasons`; Step 10 is the operator's: save the 2026 Leaderboard first, apply the migration, deploy, compare, check an installed PWA)                                                                                                                                                         |
| 015  | Read Squiggle on a schedule; serve visitors and live scores from our own copy | P1       | L      | MED  | 013, 014   | IN PROGRESS (Steps 1-12 done on `advisor/015-squiggle-sync`; released 2026-11-27 and backfilled; 2026 Leaderboard checked; operator: watch a day of runs, then Opening Round (13.5) and deleting the relay (13.6); 13.5 waits for Opening Round 2027)                                                                                   |
| 016  | A public architecture page, for recruiters and engineers                      | P2       | M      | LOW  | 015        | IN PROGRESS (Steps 2-8 done on `advisor/016-architecture-page`, with D1-D6 as recommended and D4 = `--primary`; operator: confirm Step 1, then Step 9 release)                                                                                                                                                                          |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Order and dependencies

Suggested: **010**, then **004**.
Schedule 004's final verification for a game day (Thu–Sun in-season) so its live end-to-end step can run.

Run each plan's drift check first:

- **010 replaces 002.** 002 was written before player stats replaced its underdog-compliance
  function, so its drift check fails today. 010's Step 1 moves every rule out of `tips.ts` into
  pure, tested functions (a superset of 002), then deletes 002 and its row.
- **010 rewrites `tips.ts`'s handlers.** Keep the Auto-tip merge (`docs/adr/0001`) in the shared
  rules, not the handlers, so the Demo gets it too.
- **010 before any leaderboard perf work** (finding #4 below): its Step 1 pins the scoring
  behaviour with tests before anything changes how those functions are called.
- **004 mentions plan 005**, which has landed: the server-side `withCache` and `api/cache.ts` are
  gone. Nothing in 004 depends on them. 004 must also reach the browser through the service
  registry (`docs/adr/0004`, written by 010), or the Demo won't get live scores; the Demo has none
  anyway, so a no-op Demo service is fine.
- **013 has a deadline**: its cutover must happen in the off-season, before Opening Round 2027.
  If plan 012 rewrites history first, re-run 013's drift check against the new `main`.
- **015 replaces 004's relay.** 004's game-day check becomes 015 Step 13.5. 015 must be live
  before Opening Round 2027; Steps 3-8 alone fix the Standard API traffic if time runs short.
- **Database access is server-only** (`docs/adr/0002`). If 004 or anything later needs the
  browser to reach Supabase directly, it adds explicit RLS policies for exactly that table and
  operation.

## Findings not turned into plans

Recorded so they aren't re-audited from scratch:

- **#4 Re-reading every Tipster row and every Tip per request** (perf, S/M) in the leaderboard,
  group-tips and player-stats server functions. Each AFL Tipping server function also upserts the
  caller's `afl_tipsters` row. The fix is HTTP response caching
  (`Cache-Control: s-maxage`) or fewer upstream queries, not an in-memory cache: on Vercel
  serverless that isn't shared across instances. Depends on 010 Step 1.
- **#5 Verbose logging** (security hygiene, S): `tips.repository.ts` and other `console.*` sites
  log user IDs and tip contents on every write. The Supabase config fields are gone (2026-10-15).
- **Every `VITE_*` variable is inlined into the client bundle** (security, found 2026-10-15):
  Clerk's `getEnvVariable` read `import.meta.env[name]` dynamically, so Vite inlined the whole
  set, not just the ones the app reads. Since Clerk went (2026-11-27) a production build inlines
  only the variables the code names: the dev-user lookup's dynamic read runs in dev only. No
  secret may be a `VITE_*` variable; `.env.example` says so. A build check that fails on
  secret-looking `VITE_*` names would enforce it.

## Considered and rejected as findings

- **`.env` committed**: it isn't. `.gitignore` covers `.env`, and no commit has ever added one.
