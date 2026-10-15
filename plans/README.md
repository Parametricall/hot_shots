# Implementation Plans

Open plans only. A plan is deleted once it's done and verified; what it decided lives on in
`docs/adr/`, and the plan itself in git history (`git log --diff-filter=D -- plans/`).

Plans 002–003 came from an improve-skill audit on 2026-07-03, against commit `612bab8`; their
numbers match the audit's finding numbers. 004 was added by the operator on 2026-07-04. Each
executor: read the plan fully before starting, honor its STOP conditions, and update your row in
the table when done.

## Status

| Plan | Title                                                                 | Priority | Effort | Risk | Depends on | Status |
| ---- | --------------------------------------------------------------------- | -------- | ------ | ---- | ---------- | ------ |
| 002  | Extract & unit-test leaderboard-scoring and underdog-compliance       | P2       | M      | LOW  | —          | TODO   |
| 003  | Remediate `npm audit` dependency vulnerabilities                      | P2       | S      | LOW  | —          | TODO   |
| 004  | Live game-score updates via Squiggle SSE (proxied `/api/live-scores`) | P2       | L      | MED  | —          | TODO   |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Order and dependencies

The three are independent and can run in any order or in parallel worktrees. Suggested: **003**
first (mechanical, confirms the toolchain still builds), then **002** (a safety net for scoring),
then **004**. Schedule 004's final verification for a game day (Thu–Sun in-season) so its live
end-to-end step can run.

All three were written before later work landed, so run each plan's drift check first:

- **002 touches `tips.ts`**, which now merges Auto-tips into the scoring inputs
  (`docs/adr/0001`). Keep that merge in the server functions, upstream of the extracted scorers.
- **004 mentions plan 005**, which has landed: the server-side `withCache` and `api/cache.ts` are
  gone. Nothing in 004 depends on them.
- **002 is a prerequisite for any leaderboard or compliance perf work** (finding #4 below): pin
  the scoring behaviour with tests before changing how those functions are called.
- **Database access is server-only** (`docs/adr/0002`). If 004 or anything later needs the
  browser to reach Supabase directly, it adds explicit RLS policies for exactly that table and
  operation.

## Findings not turned into plans

Recorded so they aren't re-audited from scratch:

- **#4 Re-fetching every Clerk user and every Tip per request** (perf, S/M) in the leaderboard,
  group-tips and compliance server functions. The fix is HTTP response caching
  (`Cache-Control: s-maxage`) or fewer upstream queries, not an in-memory cache: on Vercel
  serverless that isn't shared across instances. Depends on 002.
- **#5 Verbose logging** (security hygiene, S): `tips.repository.ts` and other `console.*` sites
  log user IDs and tip contents on every write. The Supabase config fields are gone (2026-10-15).
- **#6 Stale `README.md`** (docs/DX, S): still the TanStack template (says `pnpm`, documents a
  docs site that doesn't exist). `.env.example` now exists and `scratch_2.js` is gone.
- **Every `VITE_*` variable is inlined into the client bundle** (security, found 2026-10-15):
  Clerk's `getEnvVariable` reads `import.meta.env[name]` dynamically, so Vite inlines the whole
  set, not just the ones the app reads. No secret may be a `VITE_*` variable; `.env.example` says
  so. A build check that fails on secret-looking `VITE_*` names would enforce it.

## Considered and rejected as findings

- **`.env` committed**: it isn't. `.gitignore` covers `.env`, and no commit has ever added one.
