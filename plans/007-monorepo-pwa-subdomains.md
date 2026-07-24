# 007 — Monorepo conversion: hot-shots.dev landing + afl.hot-shots.dev PWA

> Status: planned, not executed.

## Context

The repo is a single AFL tipping app (React 19 + TanStack Start + Vite + Nitro) deployed to Vercel at `hot-shots.dev` (GoDaddy domain), used via installed PWA on phones. Goal: a monorepo hosting multiple apps, each as its own Vercel project on a subdomain of `hot-shots.dev`, each installable as a separate PWA, with a landing page at the apex linking to each app.

**Decisions made:**

1. AFL app moves to **afl.hot-shots.dev**; apex becomes a landing page. Existing installed PWAs are origin-pinned → users reinstall once; plan includes redirects + migration banners + stale-service-worker eviction.
2. **Turborepo + npm workspaces** (keep npm).
3. Landing page uses the **same TanStack Start stack**.
4. **Move first, extract later**: `apps/afl` + `apps/landing` + shared config packages only; shared UI package deferred.

**Verified repo facts the plan depends on:**

- Hand-rolled PWA: `public/site.webmanifest` (`start_url: /afl-tipping/tips`, no `id`/`scope`) + `public/sw.js` (cache `hot-shots-v2`, **network-first for navigations**, cache-first for `/assets/*`), registered in `src/routes/__root.tsx` when PROD.
- No `vercel.json`; Nitro (`nitro/vite`, nightly) auto-detects the Vercel preset via `VERCEL` env at build.
- Root `package.json` has `overrides: {"@tanstack/router-core": "1.171.14"}` (npm honors overrides **only at workspace root**) and an `imports` map `"#*" → ./*` (used by stories for `#.storybook/preview`; resolves relative to its containing package.json, so it moves with the app).
- `tsconfig.json` alias `~/*` → `./src/*`; TanStack Start entries `./app/router` / `./app/start` are app-relative → the whole app survives a directory move with near-zero source changes.
- No hardcoded `hot-shots.dev` anywhere in source.
- Clerk: single instance, no domain-specific config. Production Clerk on the root domain sets its session cookie for `.hot-shots.dev` → **subdomains share auth automatically; no satellite-domain setup needed**.

**Key cutover mechanics (drives the ordering):**

1. The old SW does **not** block redirects: navigation fetches return `opaqueredirect` (not cached, passed through), so once the apex serves 307s, even SW-controlled PWA launches get redirected — when online. Offline, the old SW serves the cached app shell, which is why eviction is also needed.
2. Every navigation triggers a SW update check of apex `/sw.js` (Vercel serves it `max-age=0`). The landing app ships a byte-different **self-destructing SW** → browser installs it → it wipes caches and unregisters.
3. Use **307** (temporary) redirects during migration; flip to 308 only weeks later once rollback is off the table (browsers cache permanent redirects forever).

---

## Phase 0 — Prep

- Clean `git status`; branch `monorepo-restructure` off `main`. Record `npm -v` (for `packageManager` field turbo requires).
- Remove stray root junk (`scratch_2.js`, stale logs) after confirming unneeded.

## Phase 1 — Move app to `apps/afl` (use `git mv`)

Target structure:

```
apps/afl/        src, public, .storybook, scripts, tsconfig.json, vite.config.ts,
                 vitest.config.ts, vitest.shims.d.ts, eslint.config.ts,
                 components.json, chromatic.config.json, package.json (new)
apps/landing/    (Phase 4)
packages/typescript-config/, packages/eslint-config/   (Phase 3)
root:            package.json (workspaces), turbo.json, package-lock.json,
                 supabase/, plans/, notes/, .github/, CLAUDE.md, README.md
```

- `apps/afl/package.json`: name `hot-shots-afl`; keep all current deps/scripts; keep the `imports` `"#*"` map **verbatim**; **remove `overrides`** (root-only in npm); drop `format`/`format:check` (root-level now); `prettier` moves to root devDeps.
- No `src/` changes needed — all aliases/entries are app-relative. Regenerate `routeTree.gen.ts` via a dev/build run and commit.
- `.gitignore`: add `.turbo/`; verify `.output`, `.vercel`, `.nitro`, `.tanstack`, `storybook-static` patterns match nested apps (unanchored entries already do).

## Phase 2 — Root workspaces + Turborepo

Root `package.json`: `workspaces: ["apps/*", "packages/*"]`, the `overrides` field, `packageManager: "npm@<version>"`, scripts delegating to `turbo run` (`dev`, `build`, `lint`, `typecheck`, `test`, `test:ci`), root-level `format`/`format:check` (prettier), devDeps `turbo` + `prettier`.

Root `turbo.json` — **strict env mode is default in Turbo 2; undeclared env vars are stripped, so the env lists are load-bearing**:

```json
{
  "globalEnv": ["NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA", "STORYBOOK"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["VITE_*", "CLERK_*", "ADMIN_USER_ID"],
      "outputs": [".output/**", ".vercel/output/**", ".tanstack/**", "src/routeTree.gen.ts"]
    },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "outputs": [] },
    "lint": { "outputs": [] },
    "test": { "outputs": [] },
    "test:ci": { "outputs": [] },
    "build-storybook": { "outputs": ["storybook-static/**"] }
  }
}
```

Cross-check env wildcards against the Vercel project's actual vars (`VITE_SUPABASE_*`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_SIGN_IN_URL/-UP_URL`, `ADMIN_USER_ID`, `VITE_ADMIN_USER_ID`, `VITE_DEV_USER_*`).

- `npm install` at root to regenerate the lockfile as a workspace tree; commit.
- **Gate:** fresh `npm ci`; `npx turbo run build typecheck lint test:ci` green; Storybook boots (validates `#.storybook` imports + `STORYBOOK=true` vite guard).

## Phase 3 — Shared config packages (thin)

- `packages/typescript-config`: `@hot-shots/typescript-config` exposing `base.json` (current compilerOptions minus `paths`/`include`). Apps extend it and add their own `~/*` paths + includes.
- `packages/eslint-config`: `@hot-shots/eslint-config` exporting a base flat-config (js/ts/react/prettier layers) from the current `eslint.config.ts`; app-specific plugins (storybook, @tanstack/query, css/json/markdown) stay in `apps/afl/eslint.config.ts` which spreads the base. jiti resolves the TS config; landing needs `eslint` + `jiti` devDeps too. Don't over-engineer — fallback is landing importing the base directly.

## Phase 4 — Scaffold `apps/landing`

Minimal TanStack Start app: **no Clerk, no Supabase, no Storybook/tests, and deliberately NOT a PWA** (no manifest link, no SW registration — an apex PWA is what caused this migration pain).

- Copy afl's `vite.config.ts` shape minus devtools/STORYBOOK guard; **port 3001** so `turbo run dev` runs both.
- `src/app/router.tsx` + `start.ts` (no clerkMiddleware), `src/routes/__root.tsx` (shell, no manifest/SW), `src/routes/index.tsx` — landing page with cards linking to `https://afl.hot-shots.dev/afl-tipping/tips`, Tailwind v4 styles, tsconfig extending the shared base.
- **`apps/landing/public/sw.js` — self-destructing takeover SW** (must be served indefinitely):

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) client.navigate(client.url).catch(() => {});
    })(),
  );
});
// deliberately NO fetch handler
```

- **Redirects (307)** — primary mechanism: Nitro `routeRules` (compiled into `.vercel/output/config.json`, honored by Vercel's Build Output API; `vercel.json` routing may be ignored when Build Output config exists):
  - `/afl-tipping` and `/afl-tipping/**` → `https://afl.hot-shots.dev/...` (preserve path)
  - `/sign-in`, `/sign-in/**`, `/sign-up` → same on afl origin
  - `/` is NOT redirected (it's the landing page).
  - Verify on the preview deploy with `curl -I`; if routeRules don't survive the preset, fall back to redirects in TanStack Start server code (always works).

## Phase 5 — AFL app migration changes (`apps/afl`)

1. `site.webmanifest`: add `"id": "/afl-tipping/tips"` and `"scope": "/"`; `start_url` unchanged.
2. `sw.js`: bump cache to `hot-shots-v3` (hygiene; new origin starts clean anyway).
3. **Migration banner** (in `__root.tsx`): when `location.hostname` is apex/www → non-dismissible top banner: "Hot Shots has moved to afl.hot-shots.dev — open it and add it to your home screen; delete the old icon." Works pre-cutover because the same build serves both origins during the bake window and the old SW is network-first for navigations.
4. **Reinstall nudge** (new origin): when on `afl.hot-shots.dev` and `!matchMedia("(display-mode: standalone)")` → dismissible (localStorage) "Add to home screen" hint with iOS/Android steps. Catches users arriving via redirect from their old PWA icon.
5. Re-grep for `hot-shots` origin assumptions before merge (none found today).

## Phase 6 — CI

- `.github/workflows/ci.yml`: keep the root prettier format job; collapse lint/typecheck/test into one job running `npx turbo run lint typecheck test:ci`.
- `.github/workflows/chromatic.yml`: add `paths: ["apps/afl/**", "package-lock.json", ...]` filters; add `workingDir: apps/afl` to the chromaui action; watch TurboSnap (`storybookBaseDir` option if it misbehaves).

## Phase 7 — Vercel projects, domains, DNS (pre-cutover)

**Reuse the existing Vercel project as `hot-shots-afl`** (it already holds every env var + proven build settings for the user-critical app); **create a new project for landing** (needs no env vars). Domain moves between same-team projects are instant and reversible, so apex ownership is a cheap late decision.

1. Existing project: rename `hot-shots-afl`; Root Directory `apps/afl`; ensure "Include source files outside of Root Directory" is enabled; Ignored Build Step `npx turbo-ignore`; Node 24. Change Root Directory immediately before merging (a failed build of pre-merge main is harmless — Vercel keeps serving the last good deploy).
2. New project `hot-shots-landing`: same repo, Root Directory `apps/landing`, same settings, no env vars.
3. **Verification point (flagged risk):** Nitro's Vercel preset writes `.vercel/output` relative to the app root, which matches Vercel's Root Directory expectation — confirm on first preview deploy (build log: "Build Completed in .vercel/output"; SSR function works).
4. **GoDaddy DNS:** add `CNAME afl → cname.vercel-dns.com` (TTL 600). Leave existing apex/www records untouched.
5. Attach `afl.hot-shots.dev` to `hot-shots-afl` (AFL now serves on both origins). Apex + www stay on `hot-shots-afl` until the flip.

**Clerk checklist (production instance):** cookie on `.hot-shots.dev` covers the subdomain — no satellite domains. Update Home URL / component redirect URLs to the afl origin; check `authorizedParties` if configured (none in code today); `CLERK_SIGN_IN_URL`/`-UP_URL` are relative paths so unchanged; OAuth redirects go via `clerk.hot-shots.dev` — unaffected; dev instances unaffected.

## Phase 8 — Production cutover (ordered)

1. **Merge** the restructure (hold the banner commit): set Root Directory, merge to main, verify apex serves the AFL app exactly as before.
2. **Verify landing** on its `*.vercel.app` URL: page renders; `curl -I .../afl-tipping/tips` → 307 to the afl origin; `/sw.js` serves the self-destructing SW with `max-age=0`.
3. **Bring up the subdomain:** CNAME + attach domain + cert. On a real phone: sign in on `afl.hot-shots.dev` (Clerk session works), install PWA, standalone + offline launch OK.
4. **Bake window (~1–2 weeks):** merge the banner commit. Apex users (incl. installed PWAs — network-first navigations fetch fresh HTML) see the migration banner every online launch.
5. **The flip (seconds, reversible):** in Vercel, move `hot-shots.dev` + `www` from `hot-shots-afl` to `hot-shots-landing`; re-establish www→apex redirect on the landing project if needed.
6. Run the post-cutover checklist immediately.

**Expected old-PWA behavior post-flip (verify on a phone):**

- Online launch: old icon → old SW passes the 307 through → lands on afl origin in a browser-decorated window → reinstall nudge shows. Meanwhile the update check installs the self-destructing SW → caches wiped, SW unregistered. Old icon keeps "working" (via redirect) until the user reinstalls and deletes it.
- Offline before takeover: cached old app still runs (Clerk cookie still valid) — degraded, self-heals next online launch.
- Offline after takeover: browser offline error, same as any website — fixed by reinstalling on the new origin.

## Phase 9 — Verification & rollback

**Local:** fresh `npm ci`; `turbo run build typecheck lint test:ci` green; both dev servers (3000/3001); Storybook + build-storybook OK; `git status` clean after build.

**Preview:** both projects build via Build Output API; `turbo-ignore` skips unaffected app on scoped commits; redirect + sw.js checks on landing; sign-in + tips render + `__BUILD_ID__` on afl.

**Post-cutover:** apex renders landing; `hot-shots.dev/afl-tipping/tips` → 307 → afl app with signed-in state preserved; www redirects; fresh-phone PWA install + offline OK; old-PWA phone lands on afl origin and apex tab shows landing (not cached AFL shell) after one reload cycle; CI + Chromatic green on first post-merge PR.

**Rollback:** move apex + www back to `hot-shots-afl` in the Vercel dashboard (seconds, no DNS). The AFL app's normal caching `/sw.js` re-registers on next launch for anyone the takeover SW touched. This is why redirects stay **307** until rollback is inconceivable. No code rollback needed — the domain move is the only lever.

## Out of scope (deferred)

- Shared UI package (`packages/ui`); any app beyond landing; Turborepo remote caching; pnpm; vite-plugin-pwa; proper icons; the 307→308 flip (~4 weeks post-cutover).

## Critical files

- `package.json` → splits into root workspace manifest + `apps/afl/package.json` (`overrides` root-only; `imports` map moves verbatim)
- `vite.config.ts` → moves; template for landing (which adds redirect routeRules, port 3001)
- `public/sw.js` → old caching SW (its network-first navigations make the cutover safe); new takeover SW at `apps/landing/public/sw.js`
- `src/routes/__root.tsx` → SW registration, manifest links, both banners
- `public/site.webmanifest` → gains `id` + `scope`
- `.github/workflows/ci.yml`, `chromatic.yml` → turbo-based CI, path-scoped Chromatic
