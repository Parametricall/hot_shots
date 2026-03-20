# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AFL (Australian Football League) tipping application built with React 19 and TanStack libraries. Users can submit tips on AFL games, view standings, and track their predictions against Squiggle's AI model.

## Commands

```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build (vite build + tsc check)
npm run lint             # ESLint
npm run format           # Prettier format
npm run typecheck        # TypeScript check (tsc --noEmit)
npm run storybook        # Storybook dev server (port 6006)
```

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

## Code Conventions

- TypeScript for all files
- Functional components with hooks
- Component structure: props interface → hooks → handlers → early returns → render
- Constants: UPPER_SNAKE_CASE
- Components: PascalCase files
- Always handle loading/error states with TanStack Query
