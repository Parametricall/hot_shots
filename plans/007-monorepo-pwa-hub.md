# 007 — One site, many installable apps: hub at `/`, each app a PWA under its own path

> Status: Phases 1–6 executed on branch `monorepo-restructure`. Phase 7 (Vercel dashboard
> settings) and Phase 8's preview/real-device verification are manual steps to do at merge time.
> **Supersedes the earlier subdomain version of this plan** (landing on the apex, AFL on
> `afl.hot-shots.dev`).

## Goal (user experience)

1. Visiting `hot-shots.dev` (browser or installed PWA) shows a **hub** that links to every app
   (AFL tipping today; NRL tipping, putt-putt scores later).
2. The hub is itself installable as a PWA ("Hot Shots") and runs every app **inside its own
   window**.
3. Each app is **also** installable on its own ("Hot Shots - AFL"), and that PWA opens straight
   to the app's main page (`/afl-tipping/tips`).
4. Hub-only users can opt in to "open straight to AFL when I launch Hot Shots".

## Decisions made (and why)

1. **Path-based, single origin — not subdomains.** A PWA's `scope` must be same-origin, so the
   hub can only contain the apps if they live on `hot-shots.dev`. With subdomains, tapping an app
   in the installed hub leaves the PWA (iOS: Safari sheet with its own cookie jar → possible
   re-sign-in; Android: Custom Tab).
2. **One Vercel project serving every app** — not one project per app. Vercel Microfrontends is
   the only clean way to put several projects under one origin, and it includes only **2
   projects** on Hobby/Pro (3rd project: not available on Hobby, $250/project/month on Pro;
   Hobby also caps routed requests at 50K/month; TanStack Start isn't a listed framework).
   Proxy rewrites between projects avoid the cap but put Clerk behind a proxy (host mismatch
   risk) and add a hop to every request. One project: adding NRL costs nothing.
3. **Existing installs keep working — no migration.** The deployed manifest (`main`) has no `id`
   or `scope`, so installed AFL PWAs have `id = /afl-tipping/tips` and
   `scope = /afl-tipping/` (defaults derived from `start_url`). This plan makes both explicit with
   **the same values** and keeps the manifest at the **same URL** (`/site.webmanifest` — Android
   WebAPK update checks key off the manifest URL). Result: no reinstall, no banners, no
   self-destructing service worker, no redirects, no DNS/domain changes.
4. **Keep the monorepo.** It's done and green; `packages/` gets real use once NRL shares tipping
   logic/UI with AFL. The single app is renamed `apps/afl` → `apps/web` since it now serves the
   whole site (cheap now — the branch isn't merged, so Vercel has never seen `apps/afl`).
5. **One service worker for the whole origin** (`/sw.js`, scope `/`). SWs are per-origin/scope,
   not per-installed-app, and the existing SW's strategy (network-first navigations, cache-first
   `/assets/*`) is app-agnostic. Every installed PWA on the origin shares it. No change needed.

## How installing works (reference for the executor)

- The browser installs whichever manifest the **current page** links via `<link rel="manifest">`.
  So manifest links move out of `__root.tsx` and into route `head()`s:
  - hub page (`/`) links `/hub.webmanifest` → "Install Hot Shots"
  - any `/afl-tipping/*` page links `/site.webmanifest` → "Install Hot Shots - AFL"
- Nested scopes on one origin are allowed as long as `id`s differ. Hub scope `/` contains AFL's
  `/afl-tipping/`; in-scope navigation inside the hub window stays in the hub. For links opened
  from outside (e.g. WhatsApp), Android picks the installed app with the most specific scope.
- **iOS:** every home-screen web app has isolated storage + cookies (separate from Safari and from
  each other). A user with both the hub and AFL PWAs signs in to each once. True under any
  architecture; just set expectations.

## Current state of the branch (verified)

- Done and kept: `apps/afl` move, root workspaces + `turbo.json`, `packages/typescript-config` +
  `packages/eslint-config`, CI (`ci.yml` runs `turbo run lint typecheck test:ci`;
  `chromatic.yml` path-scoped to `apps/afl`).
- To unwind (subdomain-only work):
  - `apps/landing/` — whole app, including the self-destructing `public/sw.js` and the Nitro
    `routeRules` 307 redirects to `afl.hot-shots.dev`.
  - `apps/afl/src/components/migration-banner.tsx` + its use in `src/routes/__root.tsx`.
  - `apps/afl/public/site.webmanifest` has `"scope": "/"` — **must not ship**: it would overlap the
    hub's scope. Deployed (effective) scope is `/afl-tipping/`.

---

## Phase 1 — Unwind the subdomain work

1. `git rm -r apps/landing`. Run `npm install` at the root so `package-lock.json` drops
   `hot-shots-landing`.
2. Delete `apps/afl/src/components/migration-banner.tsx`; remove its import and `<MigrationBanner />`
   from `apps/afl/src/routes/__root.tsx`.
3. `apps/afl/public/site.webmanifest`: set `"scope": "/afl-tipping/"`. Keep
   `"id": "/afl-tipping/tips"` and `"start_url": "/afl-tipping/tips"` exactly. Keep the file name.
4. Keep `sw.js`'s `hot-shots-v3` cache name (harmless hygiene; the activate handler deletes v2).
5. **Gate:** `npx turbo run build typecheck lint test:ci` green.

## Phase 2 — Rename `apps/afl` → `apps/web`

1. `git mv apps/afl apps/web`; `apps/web/package.json` name → `hot-shots-web`.
2. Update references (full list from `git grep`):
   - `.github/workflows/chromatic.yml` — two `paths` entries + `workingDir`
   - root `package.json` — `"chromatic": "npm run chromatic --workspace apps/web"`
   - `package-lock.json` — regenerate via `npm install`
3. `CLAUDE.md` (root) still describes the pre-monorepo layout (`src/...` at the root). Update the
   Key Directories / Commands sections to `apps/web/src/...`, and add a short "Apps on this site"
   section: hub at `/`, one feature module + route subtree + manifest per app (see Appendix).
4. **Gate:** fresh `npm ci`; `npx turbo run build typecheck lint test:ci`; `npm run storybook
--workspace apps/web` boots (the `#.storybook` imports map moved with the package).

## Phase 3 — Hub page at `/`

Today `apps/web/src/routes/index.tsx` redirects `/` → `/afl-tipping/tips`. Replace it with the hub.

1. **App registry** — `apps/web/src/features/hub/apps.ts`:

   ```ts
   export const APPS = [
     {
       id: "afl-tipping",
       name: "AFL Tipping",
       description: "Submit your tips and track your predictions.",
       href: "/afl-tipping/tips",
       icon: "/dummy-footy-logo.png",
     },
   ] as const;
   export type AppId = (typeof APPS)[number]["id"];
   ```

   Single source of truth for the hub cards, the launch-preference setting (Phase 5), and the hub
   manifest's `shortcuts` (keep in sync by hand; it's one entry per app).

2. **Hub page** — `apps/web/src/features/hub/pages/hub.tsx`: a card per `APPS` entry (reuse the
   card design from the deleted `apps/landing/src/routes/index.tsx`, with shadcn `Card` if it
   fits). Plain `<Link to={app.href}>` — same origin, client-side navigation.
3. **Route** — `apps/web/src/routes/index.tsx` renders the hub page. Public (not under
   `_authenticated`) — the hub needs no user data. Add `data-app-ready` if `AppLoadingScreen`
   relies on it (check how `sign-in.tsx` uses it).
4. **Header** (`apps/web/src/components/header.tsx`): the logo `<Link to="/">` used to land on
   tips via the redirect; now it would go to the hub. Point the logo at `/afl-tipping/tips` (app
   home), and add a small "All apps" link (lucide `LayoutGrid` icon) to `/`.
   Known behavior: inside the **AFL-only** PWA, `/` is out of scope, so "All apps" opens in the
   browser overlay (Android toolbar / iOS Safari sheet). Acceptable — that user chose the
   single-app install.
5. Stories: `hub.stories.tsx` next to the page (`withRouter` decorator). Test: renders one card
   per `APPS` entry with the right `href`.

## Phase 4 — Per-app manifests

1. **Hub manifest** — new `apps/web/public/hub.webmanifest`:

   ```json
   {
     "id": "/",
     "name": "Hot Shots",
     "short_name": "Hot Shots",
     "start_url": "/?launch=pwa",
     "scope": "/",
     "display": "standalone",
     "theme_color": "#f9fafb",
     "background_color": "#f9fafb",
     "icons": [
       {
         "src": "/hub-icon.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "any maskable"
       }
     ],
     "shortcuts": [{ "name": "AFL Tipping", "url": "/afl-tipping/tips" }]
   }
   ```

   - `id: "/"` is explicit so `start_url` can change later without creating a new app.
   - `?launch=pwa` is what Phase 5 keys off; it only appears on PWA launches.
   - **Needs a distinct icon** — two identical footy icons on a home screen is confusing. A
     placeholder `hub-icon.png` (512×512) is fine; proper icons remain out of scope.
   - `shortcuts` = Android long-press menu. iOS ignores it.

2. **AFL manifest** — `site.webmanifest` stays as fixed in Phase 1. Optionally change `short_name`
   to "AFL Tips" to tell the two icons apart (`name`/`short_name` changes are allowed manifest
   updates; `id`, file URL, and `scope` must not change).
3. **Move manifest links out of `__root.tsx`:**
   - `__root.tsx` keeps icons/apple-touch-icon/theme-color but **drops** the `rel="manifest"` link.
   - `routes/index.tsx` `head()` adds `{ rel: "manifest", href: "/hub.webmanifest" }` + an
     `apple-touch-icon` pointing at the hub icon.
   - `routes/_authenticated/afl-tipping.tsx` `head()` adds
     `{ rel: "manifest", href: "/site.webmanifest" }`.
   - Verify in the SSR HTML that each page has **exactly one** manifest link (TanStack Router
     merges `head()` from matched routes; child `links` are appended, not deduped).
   - Titles: root title becomes "Hot Shots"; the AFL layout sets "Hot Shots - AFL" (iOS uses the
     page title as the default home-screen name).
4. `/sign-in`, `/sign-up` link no manifest (nothing to install there).

## Phase 5 — "Open straight to my app" for hub users

A **cookie**, not `localStorage`: the redirect has to happen during SSR in `beforeLoad` so the hub
never flashes, and SSR can't read `localStorage`.

1. `apps/web/src/features/hub/api/launch-app.ts`:
   - `getLaunchApp` — `createServerFn({ method: "GET" })`, reads cookie `hs_launch_app` with
     `getCookie` from `@tanstack/react-start/server`, returns the matching `APPS` entry or `null`
     (ignore unknown values).
   - `setLaunchApp` — `createServerFn({ method: "POST" })`, input validated with Zod as `AppId |
null`; `setCookie("hs_launch_app", id, { path: "/", maxAge: 365 days, sameSite: "lax",
httpOnly: true, secure: true in prod })`, or `deleteCookie` for `null`.
   - This is first-party state, not a third-party API, so the service-registry rule doesn't apply;
     still co-locate it in `features/hub/api/` like other server fns.
2. `routes/index.tsx`:

   ```ts
   validateSearch: z.object({ launch: z.literal("pwa").optional() }),
   beforeLoad: async ({ search }) => {
     if (search.launch !== "pwa") return;
     const app = await getLaunchApp();
     if (app) throw redirect({ href: app.href });
   },
   ```

   Only PWA launches carry `?launch=pwa`, so tapping "All apps" (plain `/`) always shows the hub —
   the preference can never trap a user inside an app.

3. Hub UI: under each card, a "Open this app when I launch Hot Shots" toggle (shadcn `Switch`),
   one active at a time. Seed state from `getLaunchApp` in the route loader; on change call
   `setLaunchApp` and invalidate.
4. Known limitations (document in the component's comment, don't engineer around):
   - iOS: the installed hub has its own cookie jar — the setting must be made **inside** the
     installed hub, not in Safari.
   - Offline launch with a preference set: the SSR 307 isn't cacheable by the SW (navigation
     redirects come back as `opaqueredirect`), so `/?launch=pwa` fails offline. Users can still
     open the AFL-only PWA offline.

## Phase 6 — Sign-in redirect-back

With the hub at `/`, anything that used to rely on `/` → tips now lands on the hub.

1. `routes/_authenticated.tsx`: redirect with the attempted URL —
   `throw redirect({ to: "/sign-in", search: { redirect_url: location.href } })` (`location` is in
   `beforeLoad`'s args; `href` is path + search, same-origin).
2. `routes/sign-in.tsx` and `sign-in.$.tsx`: `validateSearch: z.object({ redirect_url:
z.string().optional() })`. Clerk's `<SignIn>` reads `redirect_url` from the query string by
   itself — confirm against Clerk docs for `@clerk/tanstack-react-start` and, if it doesn't,
   pass it as `forceRedirectUrl`. Only accept values starting with `/` (open-redirect guard).
3. `DevLoginButtons` in `features/auth/pages/sign-in.tsx`: replace `window.location.href = "/"`
   with the validated `redirect_url ?? "/afl-tipping/tips"`.
4. Sign-in stays at `/sign-in` (shared by every app, covered by the hub's scope). In the AFL-only
   PWA it's out of scope — identical to today's production behavior, so no regression. Moving
   sign-in under each app's scope is deferred (see Out of scope).

## Phase 7 — Vercel (no domain or DNS changes)

The existing project keeps `hot-shots.dev` + `www`, all env vars, and Clerk config.

1. Immediately before merging: Settings → Build & Deployment → **Root Directory `apps/web`**;
   enable "Include source files outside of the Root Directory"; Node 24; Ignored Build Step
   `npx turbo-ignore` (skips plan/doc-only commits). A failed build of pre-merge `main` in the
   meantime is harmless — Vercel keeps serving the last good deployment.
2. **Verification point (carried over risk):** confirm Nitro's Vercel preset writes
   `.vercel/output` relative to `apps/web` (build log shows the Build Output API being used; SSR
   routes and server functions work on the preview URL).
3. Clerk: nothing to change — same origin, same instance.

## Phase 8 — Verification

**Local:** fresh `npm ci`; `npx turbo run build typecheck lint test:ci`; `npm run dev` → `/`
shows the hub, card → tips, logo → tips, "All apps" → hub; signed-out visit to
`/afl-tipping/standings` → sign-in → back to standings.

**Preview deploy** (Clerk preview/dev instance as configured): same as local, plus

- `curl -s <preview>/ | grep manifest` → only `/hub.webmanifest`;
  `/afl-tipping/tips` (signed in, via browser devtools) → only `/site.webmanifest`.
- Chrome devtools → Application → Manifest on each page: correct `id`, `scope`, no errors;
  "Installability" passes for both.
- `/?launch=pwa` with the cookie set → 307 to `/afl-tipping/tips`; without the cookie → hub.

**Real phones after production deploy** (Android Chrome + iOS Safari):

- [ ] **Existing AFL install** (made before this deploy): launches to tips, still standalone,
      still signed in — no reinstall prompt, no duplicate icon.
- [ ] Fresh install from `/` → "Hot Shots" hub icon; tapping AFL stays inside the hub window.
- [ ] Fresh install from `/afl-tipping/tips` → AFL-only icon, opens to tips.
- [ ] Both installed side by side: distinct icons/names; each opens to the right place.
- [ ] Hub launch preference → next hub launch opens straight to tips; "All apps" still reaches
      the hub.
- [ ] Offline launch of the AFL-only PWA shows the cached shell (SW unchanged).
- [ ] Android: long-press hub icon shows the "AFL Tipping" shortcut.

**Rollback:** Vercel → Deployments → Instant Rollback to the previous production deployment. `/`
goes back to redirecting to tips; hub installs made in the meantime launch `/?launch=pwa` → tips.
Existing AFL installs are unaffected either way (their `id`/`scope`/manifest URL never changed).

## Out of scope (deferred)

- NRL / putt-putt apps themselves (see Appendix for the recipe).
- Shared `packages/ui` or `packages/tipping-core` — extract when NRL needs it, not before.
- Sign-in inside each app's scope (`/afl-tipping/sign-in`) — only worth it if the AFL-only PWA's
  out-of-scope sign-in (unchanged from today) bothers users.
- Proper icons/splash screens; per-app theme colors.
- Turborepo remote caching.

## Appendix — Adding a new app (e.g. NRL tipping)

No Vercel, DNS, or Clerk changes. In `apps/web`:

1. Feature module `src/features/nrl-tipping/` (api, components, pages, `queries.ts` with a root
   key `["nrl"]` — AFL's keys are already rooted at `["afl"]`, so the shared persisted query cache
   can't collide). Register its services in `src/app/service-registry.ts` / `router.tsx`.
   Revisit the AFL-specific `invalidateQueries` predicate in `router.tsx` (`queryKey[1] !==
"teams"`) so it still does the right thing for NRL keys.
2. Routes under `src/routes/_authenticated/nrl-tipping/` with a layout whose `head()` links
   `/nrl-tipping.webmanifest`.
3. `public/nrl-tipping.webmanifest`: `id` + `start_url` `/nrl-tipping/tips`, `scope`
   `/nrl-tipping/`, its own icon. **Never change its `id`, `scope`, or file name after launch.**
4. Add an entry to `APPS` (`features/hub/apps.ts`) and a `shortcuts` entry to `hub.webmanifest`.
5. Namespace any new `localStorage` keys (`nrl:*`) — all apps share one origin's storage.

## Critical files

- `apps/web/public/site.webmanifest` — AFL identity; `id`/`scope`/URL frozen
- `apps/web/public/hub.webmanifest` — new hub identity
- `apps/web/src/routes/__root.tsx` — drops manifest link + MigrationBanner
- `apps/web/src/routes/index.tsx` — redirect → hub page + launch redirect
- `apps/web/src/routes/_authenticated.tsx`, `sign-in*.tsx`, `features/auth/pages/sign-in.tsx` — redirect-back
- `apps/web/src/routes/_authenticated/afl-tipping.tsx` — AFL manifest link + title
- `apps/web/src/features/hub/` — registry, page, launch-app server fns
- `apps/web/src/components/header.tsx` — logo target + "All apps"
- `.github/workflows/chromatic.yml`, root `package.json`, `CLAUDE.md` — path rename
