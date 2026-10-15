# Supabase is reached only from the server, with RLS denying everyone else

The browser never talks to Supabase. Server functions check the Clerk session, then read and
write through a client built from the secret key (`src/lib/supabase.ts`), which bypasses
Row-Level Security. Every table has RLS on and **no policies**, so the publishable (anon) key,
which is public by design and inlined into the client bundle, can read and write nothing.

Before this, RLS was off and the anon key was the only gate: anyone could take it from the bundle
and read every Tip before Lockout, or overwrite other Tipsters' Tips, straight through the
Supabase REST API, skipping every check in the server functions.

## Considered options

| Option                                                   | Why not                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-user policies on Clerk JWTs (`auth.jwt() ->> 'sub'`) | The Leaderboard, the Group tips page and Auto-tips read every Tipster's Tips, so it needs read-all policies plus per-user writes; Clerk third-party auth adds setup that can drift |
| Secret key on the server, RLS on with no policies        | Chosen: one gate (the server functions), and a forgotten check can't be bypassed from the browser                                                                                  |

## Consequences

- A new table is open to the anon key until its migration enables RLS. Every `create table`
  migration must `alter table … enable row level security` too.
- Anything that needs the browser to reach Supabase directly (Realtime, say) must add explicit
  policies for exactly that table and operation, not move the secret key to the client.
- The Clerk third-party auth block in `supabase/config.toml` is unused for now; per-user policies
  would revive it.
