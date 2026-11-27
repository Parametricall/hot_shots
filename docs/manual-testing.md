# Manual testing checklist

Features that landed with automated tests but still want a human pass. Tick items off as you go and
add a date. Terms follow `GLOSSARY.md`.

## Hub and installable apps

Status: deployed. The real-device checks below are still to do. See
`docs/adr/0003-every-app-on-one-origin.md`.

### Hub (`/`)

- [ ] `/` shows the Hub with one card per App (AFL Tipping today)
- [ ] Tapping the AFL card opens `/afl-tipping` (which lands on My Tips of the Current Season)
      without a full page reload
- [ ] Header logo goes to `/afl-tipping`; the "All apps" link goes to `/`
- [ ] SSR HTML of `/` has exactly one manifest link (`/hub.webmanifest`)
- [ ] SSR HTML of `/afl-tipping/*` has exactly one manifest link (`/site.webmanifest`)
- [ ] `/sign-in` and `/sign-up` link no manifest

### Launch preference

- [ ] Hub card has an "Open this app when I launch Hot Shots" switch; only one can be on at a time
- [ ] With it on, `/?launch=pwa` redirects to `/afl-tipping`
- [ ] With it on, plain `/` (via "All apps") still shows the Hub
- [ ] With it off, `/?launch=pwa` shows the Hub
- [ ] iOS: the setting has to be made inside the installed Hub, not Safari (own cookie jar)

### Sign-in redirect-back

- [ ] Signed out, open `/afl-tipping/standings`, sign in, land back on Stats, AFL Ladder view
- [ ] `redirect_url` that doesn't start with `/` is ignored (open-redirect guard)
- [ ] Dev login buttons honour `redirect_url`, default `/afl-tipping`

### PWA installs (real phones, after production deploy)

- [ ] Existing AFL install (made before the deploy) still opens to tips, standalone, signed in, no
      reinstall prompt or duplicate icon. Its `start_url` is the old `/afl-tipping/tips`, which
      redirects to the Current Season
- [ ] Fresh install from `/` gives a "Hot Shots" Hub icon; tapping AFL stays in the Hub window
- [ ] Fresh install from `/afl-tipping` gives the AFL-only icon, opens to tips
- [ ] Both installed side by side: distinct icons and names, each opens in the right place
- [ ] Chrome DevTools, Application, Manifest: correct `id` and `scope` on each page, installable
- [ ] Offline launch of the AFL-only PWA shows the cached shell
- [ ] Android: long-press the Hub icon shows the "AFL Tipping" shortcut

## Seasons

Status: not deployed. See `docs/adr/0007-tipsters-enter-each-season.md` and plan 014. Run these in
`vp dev` (or `npm run dev:demo` for the Demo checks), then the installed-PWA checks on real phones.

### Routes

- [ ] `/afl-tipping` lands on My Tips of the Current Season (`/afl-tipping/<season>/tips`), or on
      the Season summary (`/afl-tipping/<season>`) when the Current Season is over
- [ ] With the app already open once, reopening `/afl-tipping` redirects with no loading screen
- [ ] `/afl-tipping/tips?round=3` lands on `/afl-tipping/<current>/tips?round=3`; likewise
      `/afl-tipping/group-tips`, `/afl-tipping/standings` and `/afl-tipping/stats`
- [ ] `/afl-tipping/1999/tips` and `/afl-tipping/abc` show Not Found
- [ ] The back button after a redirect doesn't bounce back to `/afl-tipping`
- [ ] If Squiggle is down and nothing is cached, `/afl-tipping` shows an error with a retry, not a
      guessed Season

### Season summary, switcher and banner

- [ ] The four sections and ⋯ More fill the bottom bar at 360px; on the Season summary none is
      selected
- [ ] The Season switcher is in the ⋯ More sheet
- [ ] In progress: a "Tip Round N" button, the top three so far, your own rank, no Wooden spoon
- [ ] Over: "<season> Season, final", the podium, the Wooden spoon, your finish, "Full Leaderboard"
- [ ] Tied Tipsters on a podium rank are all shown with "=2nd" style ranks; Tipsters level on last
      place share the Wooden spoon; three or fewer Tipsters means no Wooden spoon
- [ ] With one Season, More lists just that Season, ticked. With two it lists them newest first,
      ticks the one open, marks the Current Season, keeps the open tab and drops `?round`
- [ ] On a past Season a banner reads "You're viewing <season>. Back to <current>", linking to the
      Current Season's My Tips, or its summary when that is over
- [ ] A past Season's My Tips is read-only: every Game is locked

### Entering a Competition

- [ ] Opening the App in the Current Season gives the Tipster an `afl_competition_entries` row for it
- [ ] Viewing a past Season enters nothing
- [ ] A Tip saves with `afl_tipping.season` set to the Game's Season
- [ ] A 2026 Tipster who hasn't opened the App in 2027 isn't on the 2027 Leaderboard
- [ ] The 2026 Leaderboard after the migration matches the one saved before it (scores, Margin
      differences and ranks)

### Demo (`npm run dev:demo`)

- [ ] `/afl-tipping` opens on My Tips at the start position
- [ ] Time control to "Season over", then `/afl-tipping` lands on the 2026 summary with a podium
      and a Wooden spoon
- [ ] ⋯ More lists only 2026

### Installed PWA

- [ ] iOS: an install made before this change launches and lands on the Current Season
- [ ] Android: same, and the Hub shortcut "AFL Tipping" lands on the Current Season

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

### Round tab (was Player Tips)

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
- [ ] My Tips loads at a normal speed (it now also fetches games and the Tipster's join date)

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
      from the browser with the access token `getRealtimeToken` gives them

## Supabase Auth

Status: deployed 2026-10-22, Clerk removed 2026-11-27. See
`docs/adr/0006-supabase-auth-replaces-clerk.md` and `docs/inviting.md`.

### Signing in

- [ ] An invited Google account signs in, lands on My Tips, and has an `afl_tipsters` row
- [ ] An invited address with no Google account signs in with the emailed code
- [ ] An uninvited account is turned away, with Google and with the emailed code: the page says
      the address isn't on the invite list, and no `auth.users` or `profiles` row is created
- [ ] Opening `/afl-tipping/tips` signed out goes to `/sign-in` with `redirect_url`, and signing in
      lands back on it
- [ ] `/auth/callback?next=//evil.com` lands on `/afl-tipping/tips`
- [ ] Sign out, from the avatar's menu, lands on `/sign-in`

### iPhone

- [ ] In Safari and in the app installed to the home screen: sign in with Google, close it, and
      open it again the next day. It is still signed in, in both
- [ ] In Safari's Web Inspector the `sb-…-auth-token` cookies are `HttpOnly` and expire about 400
      days out
- [ ] If Google sign-in started from the installed app comes back in Safari instead, record it in
      ADR 0006's last Consequence. The emailed code is the workaround there

### Clerk gone

- [ ] `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_SIGN_IN_URL` and `CLERK_SIGN_UP_URL`
      removed from `.env` and every Vercel environment, the Demo project's included
- [ ] The Clerk production and development applications deleted

## Mobile navigation overhaul

Status: not deployed. Run in `npm run dev:demo` with the browser at 375px wide (device toolbar,
iPhone SE or 12), then once on a real phone, and again at 1280px for desktop.

### Bottom bar and sections

- [ ] A bar is fixed to the bottom with Tips, Round, Leaderboard, Stats and ⋯ More, each at least
      44px tall; the one you're on is highlighted (and read out as "current page")
- [ ] Switching section keeps `?round=` in the URL; the Season summary highlights none
- [ ] On desktop the same four labels are a row of tabs at the top, with a "More" button at its
      end, and no bottom bar
- [ ] `/afl-tipping/<season>/standings` lands on Stats with the AFL Ladder segment selected
- [ ] Stats has a "Tipsters | AFL Ladder" control; the choice survives a reload (`?view=ladder`)
- [ ] The Leaderboard is no longer on the Stats page; "Full Leaderboard" on the Season summary
      opens the Leaderboard tab

### Season switcher

- [ ] The header and the Leaderboard title ("2026 Leaderboard") have no Season switcher
- [ ] ⋯ More opens a sheet from the bottom (a panel from the right on desktop) headed "AFL
      Tipping", with a "Season" list; picking a Season closes it and stays on the open tab
- [ ] The More item stays highlighted while its sheet is open; Escape or tapping outside closes it
- [ ] Under the Seasons, "How tipping works" opens the rules page and closes the sheet; the bottom
      bar stays, with no section highlighted. Picking a Season from More there stays on the rules
- [ ] The rules read well at 360px: six headed sections, and the Underdog quota says 2
- [ ] On another tab of a past Season the "You're viewing" banner still links back

### Header

- [ ] The header is 48px with a small logo and "AFL Tipping"; no "All apps" link in it
- [ ] The avatar menu has "All apps" (to the Hub) and, outside the Demo, "Sign out"
- [ ] In the Demo the avatar opens a menu with "All apps" only

### Round chips and status line

- [ ] A phone shows a sideways-scrolling strip of Round chips (Opening, R1..., Finals in orange),
      with the selected Round centred, also after a reload on a late Round
- [ ] Each chip has a dot: green all tipped, amber a Game still open is untipped, grey locked or done
- [ ] Under the strip: "6/9 tipped · Next game Thu 7:40pm (2d 3h)", then "Round in progress" and
      "Round complete" as the Demo clock moves; the time matches the first Game card's time
- [ ] Set the computer's time zone to Perth and reload: the Game card times, day headings and the
      status line all move to Perth time, with no hydration warning in the console; set it back
- [ ] The strip and status line stay put under the header while the Games scroll; the date
      headings stick just below them
- [ ] Stats, Tipsters, By Round uses the same `?round=` as the tipping pages

### Underdog quota chip

- [ ] My Tips shows "Underdogs 0/2" (amber) once the Model has tipped, "2/2" (green) when met
- [ ] Tapping it explains the rule, including "Don't be a shit bloke."
- [ ] It doesn't show in Finals, or before the Model has tipped the Round

### Leaderboard

- [ ] Rank movement (up green, down red, a dash for none) shows after the first Round is complete
- [ ] "Rnd" is each Tipster's Correct tips in the latest Round; the column is "Margin diff"
- [ ] Scroll your own row off screen: a copy is pinned above the bottom bar (and above the Demo
      Time control); it disappears when your row is back in view
- [ ] Once the Season is over the Wooden spoon card shows under the list

### Round tab

- [ ] After Lockout each Game shows a home/away split bar with percentages and the Model tip
- [ ] Before Lockout there is no split bar and no one's pick is shown

### AFL Ladder

- [ ] On a phone teams show as abbreviations; wider screens show full names
- [ ] A % column; a dashed line under 10th place (8th for Seasons before 2026)

### Scrolling, safe areas, tap targets

- [ ] The whole page scrolls (the browser bars can tuck away); nothing hides behind the bottom bar
- [ ] On an iPhone with a notch/home indicator the header and bar clear them
- [ ] Demo: the Time control sits above the bottom bar and the last Game can scroll clear of both
- [ ] Margin -/+ buttons and the Stats round arrows and "By Round | Season" toggle are easy to hit
