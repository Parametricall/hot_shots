-- Drop the afl_tipping policies created in the Supabase dashboard when the project
-- was set up; no migration ever recorded them. They granted the `authenticated`
-- role, which every signed-in Tipster's Clerk token carries, so a Tipster could
-- read every Tip and insert or update Tips straight from the browser, skipping
-- the server functions' Lockout and ownership checks.
--
-- The app reads and writes through the secret key, which bypasses RLS, so it
-- needs no policies (docs/adr/0002-supabase-is-server-only.md). `if exists`
-- keeps this a no-op on local databases, which never had them.
drop policy if exists "Allow authenticated select on afl_tipping" on afl_tipping;
drop policy if exists "Enable insert for authenticated users only" on afl_tipping;
drop policy if exists "Users can update their own tips" on afl_tipping;
