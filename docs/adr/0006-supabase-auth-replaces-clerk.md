# Supabase Auth replaces Clerk, invite-only, with the session in cookies only the server touches

Clerk's free plan ends every session 7 days after sign-in, so Tipsters had to sign in every week
of the Season, and many of them forget their passwords. We sign in with Supabase Auth instead:
Google and Facebook, plus an emailed one-time code for people without either, and no passwords.
On the free plan sessions have no time limit, so a person stays signed in on a device until they
sign out. Every auth call (starting a sign-in, the OAuth callback, refreshing the session,
signing out) runs on the server, which keeps the session in `HttpOnly` cookies it sets itself.
The browser still never talks to Supabase (`docs/adr/0002`).

The site is invite-only. A "Before User Created" hook, a Postgres function Supabase Auth runs
before creating any account, turns away every email address with no row in `invitations`. That
covers Google, Facebook and the emailed code alike.

Clerk's user list splits in two, because the site is a Hub of Apps (`docs/adr/0003`). `profiles`
holds each person's name and photo for the whole site. `afl_tipsters` records who has joined AFL
Tipping and when, which is the date Auto-tips start from (`docs/adr/0001`). A Profile joins an App
the first time they open it, so someone who joins the site in 2026 and opens a later App in 2028
doesn't get Auto-tips for that App's earlier Games.

## Considered options

| Option                                          | Why not                                                                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stay on Clerk, pay for Pro ($25/mo)             | Fixes the session length, but costs every month for something Supabase, which we already run, does for free                                                                                     |
| Better Auth (library, sessions in our Postgres) | Google's consent screen would show our own domain, and we'd control everything. But we'd own the auth tables, the library upgrades and the security fixes                                       |
| Auth0, WorkOS, Firebase Auth                    | Free tiers would work, but they add another vendor and another user list to keep in sync with Supabase                                                                                          |
| Supabase Auth with a browser client             | supabase-js in the browser writes the session cookie from JavaScript. Safari caps those cookies at 7 days on every iPhone browser, which brings the weekly sign-in back, and it breaks ADR 0002 |
| Supabase Auth, server-set cookies (chosen)      | Free, no new vendor, no session limit, and a cookie the server sets with a response header isn't capped                                                                                         |

How to keep strangers out:

| Option                                               | Why not                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turn off sign-ups, create each account in advance    | Creates accounts for people who never accept, needs the first Google or Facebook sign-in to attach to that account with sign-ups off, and keeps no invite record |
| Let anyone sign in, gate each App on an invite check | A stranger still gets an account and a session, and every App has to remember the check                                                                          |
| `invitations` table plus a Before User Created hook  | Chosen: no account exists until an invited email signs in, the hook runs on the free plan, and the table records who was invited                                 |

## Consequences

- **Invitations match by email.** A person must sign in with a Google or Facebook account that
  uses the address they were invited with. A Facebook account registered with a phone number, or
  under another address, is turned away, and the fix is a second Invitation for that address.
- **Deleting an Invitation doesn't remove anyone.** It only stops the address from creating an
  account. To remove a person, delete their Supabase Auth user; their Profile and Tipster rows
  go with it.
- **Profile, not Tipster, is the person on the site** (`GLOSSARY.md`). Code that is about the site
  (the header, the current user, sign-in) uses `profiles`. Code about one App uses that App's
  Tipster table. A new App adds its own `<app>_tipsters` table, which a Profile joins on first
  open.
- **Don't set a session limit.** A session ends when the person signs out, changes devices or
  clears their browser. A tipping app at risk of a changed Tip doesn't need more. Session limits
  are a Pro feature. If one is ever turned on, use an inactivity timeout longer than the
  off-season (200 days or more), never a time-box, or every Tipster signs in again at Opening
  Round.
- **Google's consent screen says `<project-ref>.supabase.co`**, not our domain. The sign-in page
  says so in a line under the Google button. A custom domain (Pro plus an add-on) would fix it,
  and changes nothing else.
- **Ids change** from Clerk's `user_…` strings to Supabase UUIDs. A one-off script invites and
  creates a Profile for each Clerk user by email, and `afl_tipping.user_id` is rewritten and
  becomes a foreign key to `afl_tipsters`. `afl_tipsters.joined_at` keeps each Tipster's Clerk
  sign-up date, so 2026 Auto-tips don't change.
- **The emailed code needs our own SMTP service.** Supabase's built-in email only sends to the
  project's team, two messages an hour. Invitations themselves send no email: whoever invites
  someone sends them the link.
- **The free plan pauses a project after a week with no activity.** That was already true for the
  Tips. Now, while the project is paused, nobody can sign in either. Check it before Opening Round.
- **An app installed to an iPhone home screen keeps its own cookies**, separate from Safari's. A
  person signs in once in each.
