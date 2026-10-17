# Plan 011: Make the repo public

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Steps marked **OPERATOR** happen in a dashboard
> and only the operator can do them: stop, say exactly what is needed, and
> wait. When done, update the status row for this plan in `plans/README.md` —
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git log --oneline be912f9..HEAD`. Step 1
> re-runs the secret scan over all of history anyway, so new commits only
> matter if they add files Step 1 doesn't cover (new dotfiles, data exports).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW. Flipping visibility is reversible, but anything already
  published may have been cloned or cached, which is why Step 1 comes first.
- **Depends on**: none. Plan 010 (the Demo) adds its link to the README when
  it ships.
- **Category**: repo / portfolio
- **Planned at**: commit `be912f9`, 2026-10-17

## Why this matters

The operator wants potential employers to read this code. Today the repo is
private, and its README is the TanStack.com template: it says the site is
deployed with Netlify, that you install with `pnpm`, and it documents a docs
site that doesn't exist. The README is the first thing a visitor reads.

## Current state (verified at `be912f9`)

- **Secrets in history: none.** All 262 commits were searched for Clerk keys
  (`sk_live_`, `sk_test_`), Supabase keys (`sb_secret_`, service-role JWTs),
  Chromatic tokens, `VITE_DEV_USER_*_PASSWORD` values, and committed `.env`
  files. Only `.env.example` was ever committed.
- **One Clerk user id is in history**: commit `c1dc480` (2026-04-04, the
  admin-roles feature) hard-coded an id. A Clerk user id names an account but
  can't sign anyone in, so publishing it is acceptable. It isn't in the
  current tree. No action needed unless the operator wants it gone, which
  would mean rewriting history; not recommended.
- **No personal data in tracked files**: no emails other than placeholders and
  the Squiggle User-Agent's `noreply` address, no data dumps (`backups/` and
  `*.dump` are ignored), and `notes/`, `.idea/`, `.vercel/` and `.env*` are
  ignored.
- **No LICENSE file.** Without one the code is "all rights reserved": anyone
  can read it, but nobody may reuse it.
- **CI on pull requests from forks**: `.github/workflows/ci.yml`'s `format`
  job runs `npm run format` and pushes a commit with
  `stefanzweifel/git-auto-commit-action`. On a fork's PR the token is
  read-only, so that job fails, and `checks` (which `needs: format`) never
  runs. `chromatic.yml` needs `CHROMATIC_PROJECT_TOKEN`, which GitHub doesn't
  give to fork PRs.
- **Every Clerk user is a Tipster.** `tips.ts` builds the Competition from
  every user in the Clerk instance. If production allows open sign-up,
  anyone who finds the production URL can join the real Competition and
  appear on the operator's friends' Leaderboard. A public repo makes the URL
  easier to find.
- Finding #6 in `plans/README.md` (stale README) is this plan's Step 2.

## Scope

**In scope**:

- `README.md` (rewrite)
- `LICENSE` and `package.json`'s `"license"` field (only if the operator
  chooses one in Step 3)
- `.github/workflows/ci.yml` (Step 4 only)
- `plans/README.md`

**Out of scope**: app code, rewriting git history, the Demo (plan 010).

## Git workflow

- Branch: `advisor/011-make-the-repo-public`.
- Commits: `repo: rewrite the README for a public repo`, `repo: …` per step.
- Do NOT push, open a PR, or change visibility unless the operator says so.
  Start from a clean `main`: if the working tree has the operator's
  uncommitted work, stop and ask.

## Steps

### Step 1: Re-run the scans on the final history

```bash
git log --all -p | grep -E '^\+' \
  | grep -oE 'sk_(live|test)_[A-Za-z0-9]{10,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJhbGciOi[A-Za-z0-9._-]{40,}|VITE_DEV_USER_[0-9]+_PASSWORD=.+|CHROMATIC_PROJECT_TOKEN=.+' \
  | sort -u | sed -E 's/(.{18}).*/\1…/'
git log --all --name-only --format= | sort -u | grep -iE '(^|/)\.env|backup|dump|\.csv$|\.pem$|\.key$'
```

Expected: the first prints nothing; the second prints only `.env.example`.
If `gitleaks` is installed, also run `gitleaks detect --log-opts="--all"`.
Print matches truncated, as above, never in full.

**Verify**: the outputs are as expected. Anything else is a STOP.

### Step 2: Rewrite the README

Use the glossary's words (Hub, App, Tipster, Competition, Tip, Model).

1. **Title and two sentences**: what Hot Shots is. A site of tipping Apps;
   AFL Tipping is the first, where friends tip each Game and play against
   Squiggle's Model.
2. **Live demo**: leave out until plan 010 ships. Do **not** link the
   production site: it's the operator's private Competition.
3. **Screenshots**: the tips page and the Leaderboard, at phone width. They
   must not show real Tipsters' names, so take them from the Demo (plan 010)
   or from Storybook stories that use the mock factories, never from
   production. If neither is possible yet, leave a `<!-- screenshots -->`
   placeholder and say so in the report.
4. **Stack**: React 19, TanStack Start / Router / Query, Clerk, Supabase,
   Tailwind v4 + shadcn/ui, Zod, Vite+ (Oxlint, Oxfmt, Vitest), Storybook +
   Chromatic, Vercel.
5. **How it's built**, short, each item linking to where it's recorded:
   - Every third-party call goes through the service registry
     (`src/app/service-registry.ts`).
   - The database is reachable only from server functions, with RLS denying
     the publishable key (`docs/adr/0002`).
   - Every App is on one origin and each installs as its own PWA
     (`docs/adr/0003`).
   - Missed Tips become Home team Auto-tips (`docs/adr/0001`).
   - Point at `docs/adr/` and `GLOSSARY.md`.
6. **Running it locally**: Node 24, `npm ci`, copy `.env.example` to `.env`
   and fill it in (say which accounts are needed: a Clerk app and a Supabase
   project, or `npx supabase start` for a local one), `npm run dev`.
7. **Scripts**: the command table from `AGENTS.md`.

No TanStack template text survives.

**Verify**: `npm run check`. Preview the Markdown, check every link
resolves, and check it reads well on GitHub's mobile layout (short lines,
small images).

### Step 3: OPERATOR — choose a licence

Ask the operator:

- **No licence** (recommended for a portfolio): the code stays all rights
  reserved. Employers can read it; nobody may reuse it. Add nothing.
- **MIT**: anyone may reuse it with attribution. Add `LICENSE` with the
  standard MIT text, the year 2026 and the operator's chosen name, and set
  `"license": "MIT"` in `package.json`.

Do not choose for them.

### Step 4: Let CI run on PRs from forks

In `.github/workflows/ci.yml`, run the auto-commit only when the PR's branch
is in this repo:

- `format` job: keep `npm run format` + auto-commit when
  `github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`.
- Otherwise run `npm run format:check`, so a fork's PR fails with a clear
  message instead of a push error.

Leave `chromatic.yml` as is: GitHub doesn't give it the token on fork PRs,
which is the safe behaviour.

**Verify**: `npm run check`. The workflow YAML parses (`gh workflow view ci`
after pushing, or `npx yaml-lint .github/workflows/ci.yml`).

### Step 5: OPERATOR — before flipping

Give the operator this checklist:

1. **Clerk production instance** → Restrictions: set sign-up mode to
   **Restricted** (invitations only), if it isn't already. Every Clerk user
   joins the real Competition.
2. **Vercel production project** → Settings → Git: keep **Git Fork
   Protection** on, so a fork's PR can't build with production's environment
   variables without approval.
3. **GitHub** → Settings → Actions → General: "Require approval for fork pull
   request workflows" set to at least "first-time contributors" (the default).

### Step 6: OPERATOR — make it public

1. GitHub → Settings → General → Danger Zone → **Change visibility** →
   Public.
2. Settings → Code security: turn on **Secret scanning** and **Push
   protection**, and **Dependabot alerts**.
3. The repo's About box: a one-line description, the website (the Demo's URL
   once plan 010 ships), and topics: `react`, `tanstack-start`, `supabase`,
   `clerk`, `afl`, `pwa`.
4. Pin the repo on the operator's GitHub profile.

**Verify**: in a logged-out browser the repo opens, the README renders with
its images, and `docs/adr/` links work. Secret scanning shows no alerts.

### Step 7: Update the plans index

Set this plan's row to DONE, and remove finding #6 from "Findings not turned
into plans".

## Done criteria

- [ ] Step 1's scans are clean
- [ ] README rewritten, with no template text and no production link
- [ ] Licence decided (a file added, or none deliberately)
- [ ] CI no longer fails at the format step on a fork's PR
- [ ] Production sign-up restricted, fork protections confirmed
- [ ] Repo public; secret scanning and push protection on
- [ ] `plans/README.md` updated

## STOP conditions

- Step 1 finds anything that looks like a credential, a password, or real
  users' data. Report the commit and file, with the value truncated. The fix
  is to rotate the credential, and maybe rewrite history; that's the
  operator's decision.
- The working tree has uncommitted work that isn't yours.
- Production Clerk allows open sign-up and the operator chooses to keep it:
  record that decision in the report, then continue.
