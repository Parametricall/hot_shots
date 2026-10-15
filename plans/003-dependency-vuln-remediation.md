# Plan 003: Remediate the known dependency vulnerabilities reported by `npm audit`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 612bab8..HEAD -- package.json package-lock.json`
> If either file changed since this plan was written, re-run `npm audit` and
> compare against the "Current state" list before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / dependencies
- **Planned at**: commit `612bab8`, 2026-07-03

## Why this matters

`npm audit` reports 9 vulnerable packages, including two **high**-severity ones
on runtime/build-adjacent paths and four **critical** ones in the dev/test
toolchain. The most important is `undici` (the HTTP client used server-side):
its advisories include a TLS certificate-validation bypass, HTTP header/response
injection, and cache cross-user disclosure. It reaches the app transitively via
`@tanstack/react-start` (a runtime dependency) and `jsdom`. `vite` also has a
high-severity `server.fs.deny` bypass. Every one of these has an **in-range
fix** — updating resolves them without a breaking major-version bump — so this
is a cheap, high-value hygiene fix. Leaving it means shipping known-vulnerable
transitive code and a noisy `npm audit` that hides the next real advisory.

## Current state

`npm audit` at commit `612bab8` (each has an in-range fix — none require a
major bump):

| Package                      | Severity | Direct?         | Notes                                              |
| ---------------------------- | -------- | --------------- | -------------------------------------------------- |
| `vitest`                     | critical | yes (dev)       | test runner                                        |
| `@vitest/browser`            | critical | yes (dev)       | storybook/browser tests                            |
| `@vitest/browser-playwright` | critical | yes (dev)       | browser test provider                              |
| `@vitest/coverage-v8`        | critical | yes (dev)       | coverage                                           |
| `undici`                     | high     | no (transitive) | via `@tanstack/react-start` → cheerio, and `jsdom` |
| `vite`                       | high     | yes (dev)       | `server.fs.deny` bypass                            |
| `js-yaml`                    | moderate | no              | transitive                                         |
| `launch-editor`              | moderate | no              | transitive                                         |
| `esbuild`                    | low      | no              | transitive                                         |

The project already uses an `overrides` block in `package.json` (currently
pinning `@tanstack/router-core` to `1.170.1`) — that is the fallback mechanism
if any advisory survives `npm audit fix`.

Baseline that must stay green after the fix: `npm run typecheck` (clean),
`npm run test:ci` (79 tests pass), `npm run build` (exit 0), `npm run lint`
(exit 0).

## Commands you will need

| Purpose            | Command                | Expected on success                                         |
| ------------------ | ---------------------- | ----------------------------------------------------------- |
| Audit (report)     | `npm audit`            | lists advisories / summary count                            |
| Runtime-only audit | `npm audit --omit=dev` | fewer advisories (prod deps only)                           |
| Apply fixes        | `npm audit fix`        | updates `package-lock.json` (+ maybe `package.json` ranges) |
| Typecheck          | `npm run typecheck`    | exit 0                                                      |
| Tests              | `npm run test:ci`      | all pass (79 today)                                         |
| Build              | `npm run build`        | exit 0                                                      |
| Lint               | `npm run lint`         | exit 0                                                      |

## Scope

**In scope** (modify only):

- `package-lock.json`
- `package.json` (only if `npm audit fix` updates a direct-dependency range, or
  if you must add an `overrides` entry per Step 3)

**Out of scope** (do NOT touch):

- Application source under `src/` — no code changes; if a dependency bump were
  to require a code change, that is a STOP condition (see below).
- Do **not** run `npm audit fix --force`. `--force` installs breaking
  major-version upgrades and is out of scope for this plan.
- Do not change the existing `overrides` entry for `@tanstack/router-core`.

## Git workflow

- Branch: `advisor/003-dependency-vuln-remediation`
- Single commit is fine; subject e.g. `Remediate npm audit advisories (undici, vite, vitest)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the baseline

Run `npm audit` and save the summary line (e.g. "9 vulnerabilities …"). Confirm
the app is green before changing anything: `npm run typecheck` → exit 0,
`npm run test:ci` → all pass.

**Verify**: baseline commands exit 0; you have the "before" audit count.

### Step 2: Apply in-range fixes

Run:

```sh
npm audit fix
```

This updates `package-lock.json` (and possibly bumps direct-dependency ranges in
`package.json` for `vitest`, `@vitest/*`, and `vite`). It must **not** be run
with `--force`.

**Verify**: `npm audit` → the summary shows **0 high and 0 critical**
advisories (moderate/low transitive ones may remain if genuinely unfixable — see
Step 3). Then confirm nothing broke:

- `npm run typecheck` → exit 0
- `npm run test:ci` → all pass (still 79)
- `npm run build` → exit 0
- `npm run lint` → exit 0

### Step 3: Handle any residual high/critical advisory (only if Step 2 left one)

If `npm audit` still reports a **high or critical** advisory after Step 2 (for
example `undici` if `npm audit fix` could not reach the transitive copy), pin the
fixed version with an `overrides` entry in `package.json`. Add the package to the
existing `overrides` object using the minimum fixed version that `npm audit`
names for that advisory. Example shape (use the real fixed version from the
advisory, not a guess):

```json
"overrides": {
  "@tanstack/router-core": "1.170.1",
  "undici": "^7.28.0"
}
```

Then run `npm install` to apply, and re-run `npm audit`.

If **no** high/critical advisory remains after Step 2, skip this step entirely —
do not add overrides for moderate/low transitive advisories that have no
reachable runtime impact (that is churn, not value).

**Verify**: `npm audit --omit=dev` → 0 high/critical on runtime paths; the four
green gates (typecheck, test:ci, build, lint) still pass.

## Test plan

No new tests. This is a dependency bump; the safety net is the existing suite
plus the build:

- `npm run test:ci` → all existing tests pass unchanged.
- `npm run build` → exit 0 (catches any breakage from the `vite`/`vitest` bump).
- `npm run typecheck` and `npm run lint` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm audit --omit=dev` reports 0 high and 0 critical advisories
- [ ] `npm audit` reports 0 high and 0 critical advisories (moderate/low may remain only if genuinely unfixable without a major bump — note any in your report)
- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:ci` exits 0 (79 tests pass)
- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] Only `package.json` and/or `package-lock.json` changed (`git status`)
- [ ] `npm audit fix --force` was NOT used
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm audit fix` (without `--force`) does not clear the high/critical
  advisories, AND adding an `overrides` pin (Step 3) also fails to resolve them
  without a major bump.
- Any of `npm run typecheck`, `npm run test:ci`, `npm run build`, or
  `npm run lint` fails after the update — a dependency bump changed behavior.
  Do not start editing `src/` to make it pass; report the failure and the
  offending package.
- The only remaining path to zero advisories is `npm audit fix --force` (a
  breaking major upgrade of `vite`, `vitest`, or another core tool). That is a
  larger migration and out of scope — report it as a follow-up.

## Maintenance notes

- `undici` arrives transitively through `@tanstack/react-start`; when that
  package is next upgraded, any `overrides` pin added in Step 3 should be
  re-checked and removed if the upstream range has caught up (a stale override
  can hold a dependency _back_).
- A reviewer should confirm the diff is limited to `package.json` /
  `package-lock.json` and that `git diff package.json` shows no unintended
  range widening beyond the audited packages.
- Consider adding `npm audit --omit=dev` (non-failing, informational) to CI so
  new high/critical runtime advisories surface on PRs — deferred out of this
  plan to keep it to the remediation itself.
