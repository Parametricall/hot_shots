# Implementation Plans

Open plans only. A plan is deleted once it's done and verified; what it decided lives on in
`docs/adr/`, and the plan itself in git history (`git log --diff-filter=D -- plans/`).

Plans 002–003 came from an improve-skill audit on 2026-07-03, against commit `612bab8`; their
numbers match the audit's finding numbers. 004 was added by the operator on 2026-07-04, and 010
and 011 on 2026-10-17 (010 after a design review with the operator); 011 (make the repo public)
was done on 2026-10-18. 013 was added on 2026-10-21 after a conversation with the operator
(`docs/adr/0006`). Each executor: read the plan fully before starting, honor its STOP
conditions, and update your row in the table when done.

## Status

| Plan | Title                                                                 | Priority | Effort | Risk | Depends on | Status                                                                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------- | -------- | ------ | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 003  | Remediate `npm audit` dependency vulnerabilities                      | P2       | S      | LOW  | —          | DONE (0 vulnerabilities; fixed by the lockfile refresh in 82ba560)                                                                                                                                                                                                  |
| 004  | Live game-score updates via Squiggle SSE (proxied `/api/live-scores`) | P2       | L      | MED  | —          | IN PROGRESS (code done; live-game end-to-end and a Vercel preview check wait for a game day)                                                                                                                                                                        |
| 010  | A public, browser-only Demo with a Demo clock                         | P1       | L      | MED  | —          | IN PROGRESS (deployed, README link added; operator: phone check, screenshots)                                                                                                                                                                                       |
| 013  | Replace Clerk with Supabase Auth                                      | P1       | L      | HIGH | —          | IN PROGRESS (Steps 3-7 done on `advisor/013-supabase-auth`, 7.4 sign-in test passed; decisions: Google + emailed code, no passwords (Facebook dropped: Meta needs a verified business), cutover as soon as ready; waits on operator Step 2 dashboards, then Step 8) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Order and dependencies

Suggested: **003** (mechanical, confirms the toolchain still builds), then **010**, then **004**.
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
- **Database access is server-only** (`docs/adr/0002`). If 004 or anything later needs the
  browser to reach Supabase directly, it adds explicit RLS policies for exactly that table and
  operation.

## Findings not turned into plans

Recorded so they aren't re-audited from scratch:

- **#4 Re-fetching every Clerk user and every Tip per request** (perf, S/M) in the leaderboard,
  group-tips and player-stats server functions. The fix is HTTP response caching
  (`Cache-Control: s-maxage`) or fewer upstream queries, not an in-memory cache: on Vercel
  serverless that isn't shared across instances. Depends on 010 Step 1.
- **#5 Verbose logging** (security hygiene, S): `tips.repository.ts` and other `console.*` sites
  log user IDs and tip contents on every write. The Supabase config fields are gone (2026-10-15).
- **Every `VITE_*` variable is inlined into the client bundle** (security, found 2026-10-15):
  Clerk's `getEnvVariable` reads `import.meta.env[name]` dynamically, so Vite inlines the whole
  set, not just the ones the app reads. No secret may be a `VITE_*` variable; `.env.example` says
  so. A build check that fails on secret-looking `VITE_*` names would enforce it.

## Considered and rejected as findings

- **`.env` committed**: it isn't. `.gitignore` covers `.env`, and no commit has ever added one.
