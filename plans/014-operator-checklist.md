# Plan 014: what's left for the operator

Code for Steps 1-9 is done on `advisor/014-seasons` (not pushed). This is everything still to do,
in order. The full detail is in `014-seasons-and-season-summary.md`, Step 10.

## 0. Test locally first

- [ ] Stop the stray Demo dev server on port 3001 (left running by the implementing agent).
- [x] From this repo: `npx supabase start`. hot_shots' local stack now uses 55xxx ports, so it
      runs beside clover-studio's on 54xxx.
- [ ] `npx supabase migration up` to apply `20261124090000_seasons.sql` and keep local data. If
      it fails, `npx supabase db reset` (wipes local data), then `npm run seed:dev-users`.
- [x] `.env`'s `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` match the new stack.
- [x] John Doe and Ryan's local passwords reset to `.env`'s (`npm run seed:dev-users`).
- [ ] Clear the old `localhost` cookies (`sb-127-auth-token*`) in the browser, then sign in again.
      The session cookie is now `sb-hot-shots-auth-token`.
- [ ] For Google sign-in locally, add `http://127.0.0.1:55321/auth/v1/callback` to the Google
      OAuth client's redirect URIs. Emailed codes land in the local mail viewer at
      `http://127.0.0.1:55324`, never a real inbox.
- [ ] `npm run dev` and work through the "Seasons" section of `docs/manual-testing.md`. The
      Season switcher and the past-Season banner were only tested in components and stories,
      because the Demo has one Season, so check them against real data.

## 1. Before the migration (production)

- [ ] Plan 013 Step 8 (the Supabase Auth cutover) is done: production has `afl_tipsters`.
- [ ] On the deployed site, save the 2026 `getLeaderboard` response (browser network tab) as
      `plans/014-leaderboard-2026-before.json`. Don't commit it.
- [ ] Confirm every existing Tip is for a 2026 Game. The migration can only check `created_at`,
      not Game ids.

## 2. Release (off-season)

- [ ] Merge `advisor/014-seasons` (PR into `main`).
- [ ] Apply `supabase/migrations/20261124090000_seasons.sql` to production.
- [ ] Then deploy. Migration first, deploy second.

## 3. After the deploy

- [ ] Compare the 2026 Leaderboard with the saved file. Scores, Margin differences and ranks
      must match exactly. Then delete the file.
- [ ] On a phone with the app installed before this change, launch it. It should land on the
      Current Season.
- [ ] Set plan 014's row in `plans/README.md` to DONE, and note any follow-ups chosen from the
      plan's "Out" list. Delete this checklist.

## Worth knowing

- Squiggle refuses `q=games;complete=!100` without a year, so `fetchIncompleteGames` on `main`
  is broken today. The branch fixes it by always passing a Season.
- The 2027 Fixture is already published, so under decision D2 the app opens on 2027 as soon as
  every 2026 Game is complete.
