# Inviting people

Hot Shots is invite-only (`docs/adr/0006`). A person can sign in only if their email address has a
row in `invitations`. There is no admin page: use Supabase's Table Editor.

## Invite someone

1. Supabase → Table Editor → `invitations` → Insert row.
2. `email`: their address, **in lower case**. Leave the rest blank.
3. Send them the site's link yourself. No email goes out.

They sign in with the Google account that uses that address, or ask for an emailed code. Their first sign-in creates their Profile, and the first time they open AFL Tipping they
become a Tipster.

## They can't sign in

The page says "That email address isn't on the invite list". Their Google account probably uses
a different address from the one you invited. The quickest fix is for them to use "Email me a
code" with the invited address instead. Otherwise, ask which address their Google account uses.

- A new person: invite that address too.
- Someone who was on the site before the move from Clerk: don't invite the new address, or they'd
  get a second, empty Profile with none of their tips. Change their existing account's email
  instead: Supabase → Authentication → Users, then add an invitation for the new address.

## Stop an address joining

Delete its row in `invitations`. This doesn't remove anyone who has already joined.

## Remove a person

Supabase → Authentication → Users → delete. Their Profile, Tipster row and tips go with it
(`on delete cascade`), so think twice mid-Season.
