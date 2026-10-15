# Manual testing checklist

Features that landed with automated tests but still want a human pass. Tick items off as you go and
add a date. Terms follow `GLOSSARY.md`.

## Plan 007: hub and installable apps

Status: code merged (phases 1–6). Phases 7–8 (Vercel settings, real devices) are still manual.

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

## Plan 008: cheating feature removed

Status: code and migration deployed, tables dropped.

- [ ] Leaderboard rows have no three-dot menu, even for a Tipster whose name starts with "Ryan"
- [ ] No admin "Reporting on/off" button for the admin account
- [ ] No cheating popup on any authenticated page
- [ ] Leaderboard rank, ties sharing a rank, and the wooden spoon still look right
- [ ] `ADMIN_USER_ID` and `VITE_ADMIN_USER_ID` removed from `.env` and every Vercel environment

## Plan 009: home-team Auto-tips

Status: code on branch `auto-tips`, not deployed. **Retroactive: the 2026 Leaderboard changes on
deploy.** Tell the Tipsters. See `docs/adr/0001-missed-tips-become-home-team-auto-tips.md`.

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
- Plan 001 (RLS lockdown) must drop its lines for `cheating_reports` and `feature_flags`.
