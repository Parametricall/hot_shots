# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hot Shots is a single TanStack Start site with a hub at `/` linking to installable sports tipping
apps. AFL (Australian Football League) tipping is the first app: users submit tips on AFL games,
view standings, and track their predictions against Squiggle's AI model.

### Apps on this site

Everything lives in one TanStack Start app deployed to a single origin, so every app can share a
PWA-installable hub (see `plans/007-monorepo-pwa-hub.md` for the full rationale). Each app is:

- one feature module under `src/features/<app>/`
- one route subtree (e.g. `src/routes/_authenticated/<app>/`)
- one `public/<app>.webmanifest`, linked only from that app's route `head()`, so it can be
  installed on its own as a separate PWA

The hub itself (`src/features/hub/`) is also its own installable PWA
(`public/hub.webmanifest`) and lists every app via `features/hub/apps.ts`.

## Commands

Run from the repo root:

```bash
npm run dev               # Start dev server (port 3000) — vp dev
npm run build             # Production build (tsc check + vp build)
npm run check             # vp check (format check + lint in one pass)
npm run lint              # vp lint (Oxlint)
npm run format            # vp fmt (Oxfmt)
npm run typecheck         # TypeScript check (tsc --noEmit)
npm run test:ci           # vp test (Vitest unit + component projects)
npm run storybook         # Storybook dev server (port 6006)
```

The toolchain is [Vite+](https://viteplus.dev) (`vite-plus`, CLI `vp`). Lint (`lint`) and format
(`fmt`) config live in `vite.config.ts` — there is no `.oxlintrc.json` or `.prettierrc`. Vitest
projects still live in `vitest.config.ts`. `vite` is aliased to `@voidzero-dev/vite-plus-core` and
pinned (with `vitest`) via `overrides` in `package.json`; bump them together with `vite-plus`.

## Architecture

### Tech Stack

- **Framework**: React 19 + TanStack Router (file-based routing)
- **State**: TanStack Query for server state
- **Server Functions**: TanStack React Start (server-side functions with Clerk auth)
- **Auth**: Clerk
- **Database**: Supabase (PostgreSQL)
- **External API**: Squiggle API (AFL data)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Validation**: Zod schemas for DTO-to-domain mapping

### Key Directories

- `src/app/` - App bootstrap & configuration (router, start, service registry)
- `src/routes/` - TanStack Router file-based routes (auto-generates `routeTree.gen.ts`)
- `src/features/afl-tipping/` - Main feature module with components, API, pages, providers
- `src/features/afl-tipping/api/squiggle/` - Squiggle API integration with Zod schemas
- `src/features/afl-tipping/pages/` - Page components for afl-tipping routes
- `src/features/auth/` - Auth feature (sign-in page)
- `src/components/ui/` - shadcn/ui components
- `src/lib/` - Configured third-party libraries (utils, supabase client)

### Service Registry Pattern

All third-party API calls must go through `src/app/service-registry.ts`. This centralizes:

- Service instantiation and dependency injection
- DTO-to-domain type mapping (only place this should happen)
- Easy mocking for tests

**Important:** When creating or updating any third-party API integration, always use the service registry pattern. Never import and call third-party fetch functions directly — wrap them in a service and access them via `serviceRegistry.getService()`. This ensures all external calls can be easily mocked in tests.

### Server Functions

Located in `src/features/afl-tipping/api/tips.ts`. These are TanStack Start server functions that:

- Run server-side only
- Use Clerk for auth
- Interact with Supabase for user tips

### Routing

- `src/routes/__root.tsx` - Root layout with providers (Clerk, Query, Router)
- `src/routes/_authenticated.tsx` - Auth guard layout for protected routes
- Protected pages under `src/routes/_authenticated/`

### Query Patterns

Use hierarchical query keys:

```typescript
["fixtures", "round", roundNumber][("tips", "user", userId, "round", roundNumber)];
```

## Domain Types

Key types in `src/features/afl-tipping/types.ts`:

- `AflTeam` - Team with name, abbreviation, colors
- `AflGame` - Game with teams, venue, scores, status
- `AflUserTip` - User's tip submission
- `AflStanding` - Ladder position

## Verification

After making changes, always verify with the relevant commands:

- **TypeScript changes**: `npm run typecheck`
- **Any code changes**: `npm run build` (runs both vite build and tsc)
- **Style/lint concerns**: `npm run lint`
- **Test-adjacent changes**: `npm run test`

Run `npm run format` before committing if you've created new files.

## Code Conventions

- TypeScript for all files
- Functional components with hooks
- Component structure: props interface → hooks → handlers → early returns → render
- Constants: UPPER_SNAKE_CASE
- Components: PascalCase files
- Always handle loading/error states with TanStack Query

## Code Patterns

### Adding a New API Integration

1. Create the fetch function in `src/features/<feature>/api/`
2. Define Zod schemas for the response DTO
3. Map DTO to domain types in the service
4. Register the service in `src/app/service-registry.ts`
5. Wire it up in `src/app/router.tsx`
6. Create query options in the feature's `queries.ts`

### Adding a New Page

1. Create the page component in `src/features/<feature>/pages/`
2. Create a route file in `src/routes/` (or `src/routes/_authenticated/` for protected routes)
3. Import the page component from the feature module

### Adding a New Component

1. Place shared components in `src/components/`
2. Place feature-specific components in `src/features/<feature>/components/`
3. Co-locate stories next to the component: `component-name.stories.tsx`
4. Co-locate tests next to the component: `component-name.test.tsx`

### Writing Stories

- Import preview decorators from `#.storybook/preview`
- Use `containerDecorator` for width constraints, `centeredYDecorator` for centering
- Use mock factories from `src/features/afl-tipping/mocks/factories` for test data
- Configure services via `parameters.services` (the `withServices` decorator handles registration)
- Use `withMockUser` decorator when the component needs Clerk user context
- Use `withRouter` decorator when the component uses TanStack Router hooks

### Writing Tests

- Use Vitest + React Testing Library; import test APIs from `vite-plus/test` (not `vitest`)
- Mock `~/app/service-registry` with `vi.mock()` to control API responses
- Mock `@clerk/tanstack-react-start` when components use auth hooks
- Use `createTestQueryClient()` and `renderWithClient()` from `~/test/render`
- Use factories from `~/features/afl-tipping/mocks/factories` for test data

### Styling

- Use Tailwind CSS v4 utility classes
- Use shadcn/ui components from `src/components/ui/` — add new ones with `npx shadcn@latest add <component>`
- Use the `cn()` helper from `~/lib/utils` for conditional classes
