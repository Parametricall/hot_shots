# Hot Shots

A site of sports tipping Apps. AFL Tipping is the first: friends tip the winner of each Game in a
Season, get ranked on the Leaderboard, and play against Squiggle's Model.

<!-- screenshots -->

## Stack

React 19, TanStack Start / Router / Query, Clerk, Supabase, Tailwind CSS v4 with shadcn/ui, Zod,
Vite+ (Oxlint, Oxfmt, Vitest), Storybook with Chromatic, deployed on Vercel.

## How it's built

- Every third-party call goes through the service registry
  ([`src/app/service-registry.ts`](src/app/service-registry.ts)), so each one can be mocked.
- The database is reachable only from server functions, and row-level security denies the
  publishable key every row ([ADR 0002](docs/adr/0002-supabase-is-server-only.md)).
- Every App lives on one origin and installs as its own PWA
  ([ADR 0003](docs/adr/0003-every-app-on-one-origin.md)).
- A missed Tip becomes a Home team Auto-tip
  ([ADR 0001](docs/adr/0001-missed-tips-become-home-team-auto-tips.md)).

All decisions are recorded in [`docs/adr/`](docs/adr/), and the project's vocabulary is in
[`GLOSSARY.md`](GLOSSARY.md). Repo conventions are in [`AGENTS.md`](AGENTS.md).

## Running it locally

You need Node 24 and two accounts: a [Clerk](https://clerk.com) application and a
[Supabase](https://supabase.com) project (or run Supabase locally with `npx supabase start`).

```sh
npm ci
cp .env.example .env   # then fill it in; the file explains each variable
npm run dev            # http://localhost:3000
```

## Scripts

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the dev server (port 3000)           |
| `npm run build`     | Production build (type check + `vp build`) |
| `npm run check`     | Format check and lint in one pass          |
| `npm run lint`      | Lint (Oxlint)                              |
| `npm run format`    | Format (Oxfmt)                             |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`)          |
| `npm run test:ci`   | Unit and component tests (Vitest)          |
| `npm run storybook` | Storybook dev server (port 6006)           |
