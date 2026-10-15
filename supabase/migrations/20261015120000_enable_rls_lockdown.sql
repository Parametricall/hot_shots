-- Turn on Row-Level Security and add no policies, so the publishable (anon) key
-- and Clerk-authenticated requests are denied every row. Only the secret key,
-- used server-side in src/lib/supabase.ts, bypasses RLS.
-- See docs/adr/0002-supabase-is-server-only.md.
--
-- Deploy the server code that uses SUPABASE_SECRET_KEY before applying this:
-- applied first, the live app's anon-key client loses all access.
alter table afl_tipping enable row level security;
