---
description: Create a new React component with optional Storybook story
user_invocable: true
---

# New Component

Create a new React component following project conventions.

## Steps

1. Ask which feature the component belongs to (or if it's a shared component in `src/components/`)
2. Create the component file with:
   - Props interface defined above the component
   - Functional component with hooks, handlers, early returns, then render
   - PascalCase filename (e.g., `game-card.tsx` for `GameCard`)
3. If the component fetches data, use TanStack Query with the existing `aflQueries` patterns
4. If the component needs auth, use `useUser()` from `@clerk/tanstack-react-start`
5. Create a co-located Storybook story file (`component-name.stories.tsx`) that:
   - Imports preview decorators from `#.storybook/preview`
   - Uses mock factories for test data
   - Configures services via `parameters.services` if the component uses queries
   - Includes `withMockUser` if the component uses auth
   - Includes `withRouter` if the component uses router hooks
6. Run `npm run typecheck` to verify
