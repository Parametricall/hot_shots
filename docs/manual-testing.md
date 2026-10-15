# Manual testing checklist

Features that landed with automated tests but still want a human pass. Tick items off as you go and
add a date. Terms follow `GLOSSARY.md`.

## Hub and installable apps

Status: deployed. The real-device checks below are still to do. See
`docs/adr/0003-every-app-on-one-origin.md`.

### Hub (`/`)

- [ ] `/` shows the Hub with one card per App (AFL Tipping today)
- [ ] Tapping the AFL card opens `/afl-tipping/tips` without a full page reload
- [ ] Header logo goes to `/afl-tipping/tips`; the "All apps" link goes to `/`
- [ ] SSR HTML of `/` has exactly one manifest link (`/hub.webmanifest`)
- [ ] SSR HTML of `/afl-tipping/*` has exactly one manifest link (`/site.webmanifest`)
- [ ] `/sign-in` and `/sign-up` link no manifest

### Launch preference

- [ ] Hub card has an "Open this app when I launch Hot Shots" switch; only one can be on at a time
- [ ] With it on, `/?launch=pwa` redirects to `/afl-tipping/tips`
- [ ] With it on, plain `/` (via "All apps") still shows the Hub
- [ ] With it off, `/?launch=pwa` shows the Hub
- [ ] iOS: the setting has to be made inside the installed Hub, not Safari (own cookie jar)

### Sign-in redirect-back

- [ ] Signed out, open `/afl-tipping/standings`, sign in, land back on standings
- [ ] `redirect_url` that doesn't start with `/` is ignored (open-redirect guard)
- [ ] Dev login buttons honour `redirect_url`, default `/afl-tipping/tips`

### PWA installs (real phones, after production deploy)

- [ ] Existing AFL install (made before the deploy) still opens to tips, standalone, signed in, no
      reinstall prompt or duplicate icon
- [ ] Fresh install from `/` gives a "Hot Shots" Hub icon; tapping AFL stays in the Hub window
- [ ] Fresh install from `/afl-tipping/tips` gives the AFL-only icon, opens to tips
- [ ] Both installed side by side: distinct icons and names, each opens in the right place
- [ ] Chrome DevTools, Application, Manifest: correct `id` and `scope` on each page, installable
- [ ] Offline launch of the AFL-only PWA shows the cached shell
- [ ] Android: long-press the Hub icon shows the "AFL Tipping" shortcut

## Cheating feature removed

Status: code and migration deployed, tables dropped.

- [ ] Leaderboard rows have no three-dot menu, even for a Tipster whose name starts with "Ryan"
- [ ] No admin "Reporting on/off" button for the admin account
- [ ] No cheating popup on any authenticated page
- [ ] Leaderboard rank, ties sharing a rank, and the wooden spoon still look right
- [ ] `ADMIN_USER_ID` and `VITE_ADMIN_USER_ID` removed from `.env` and every Vercel environment

## Home-team Auto-tips

Status: deployed 2026-10-15. **Retroactive: the 2026 Leaderboard changed on deploy.** Tell the
Tipsters if you haven't. See `docs/adr/0001-missed-tips-become-home-team-auto-tips.md`.

### My Tips

- [ ] A started Game you didn't tip shows the grey strip: "You didn't tip this game, so you were
      given {Home team} (the home team)."
- [ ] A Game you did tip shows no strip
- [ ] An upcoming Game shows no strip
- [ ] Leave My Tips open across a Game's start: the strip appears without a refresh
- [ ] The Auto-tip is on the Home team, and the Home team button shows as selected

### Player Tips

- [ ] After Lockout, a Tipster who missed the Game appears under the Home team with a muted `auto`
      marker (hover title: "Didn't tip: auto-tipped the home team")
- [ ] Tipsters who tipped have no marker
- [ ] A Tipster who missed the Game is not in the "Not yet tipped" list after Lockout
- [ ] On the Margin game an Auto-tip shows `(0pts)`

### Scoring (Leaderboard and stats page)

- [ ] A Tipster who missed a Game the Home team won gets a point for it
- [ ] A Tipster who missed a Game the Home team lost gets no point
- [ ] Auto-tips never raise a Tipster's Underdog count
- [ ] A missed Margin game adds the full real margin to that Tipster's Margin difference
- [ ] Streaks: a wrong Auto-tip breaks a Streak, a right one extends it
- [ ] Accuracy and Perfect rounds include Auto-tips
- [ ] A Game with no Home team gets no Auto-tips
- [ ] A Tipster whose account was created after a Game started gets no Auto-tip for it
- [ ] Tipping a Game before Lockout still behaves as before (change it, margin, underdog warning)
- [ ] My Tips loads at a normal speed (it now also fetches games and the Clerk join date)

### Known follow-ups

- If not tipping turns out to be an advantage, the ADR's alternative is to default an Auto-tip's
  Margin to the Round's largest winning margin. That change belongs in `toAutoTipRow`.
- Plan 002 (extract scoring) must keep the Auto-tip merge upstream of the extracted scorers.

## Supabase locked to the server

Status: deployed and migration applied 2026-10-15. See `docs/adr/0002-supabase-is-server-only.md`.

- [ ] Signed in: submit a Tip, open the Leaderboard and Group tips (the server reads through the
      secret key)
- [ ] `SUPABASE_SECRET_KEY` is set in Production and Preview on Vercel, as a non-`VITE_` variable
- [ ] SQL Editor: `select relrowsecurity from pg_class where oid = 'public.afl_tipping'::regclass`
      returns `true`
- [ ] SQL Editor: `select policyname from pg_policies where tablename = 'afl_tipping'` returns no
      rows. A policy made in the dashboard would still let signed-in Tipsters reach the table
      from the browser with their Clerk token
