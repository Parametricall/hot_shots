---
description: Scaffold a new feature module following Bulletproof React pattern
user_invocable: true
---

# New Feature

Scaffold a new feature module under `src/features/`.

## Steps

1. Ask the user for the feature name and scope
2. Create the feature directory structure:
   ```
   src/features/<feature-name>/
   ├── api/          # API integration, queries, server functions
   ├── components/   # Feature-specific components
   ├── pages/        # Page components (imported by route files)
   ├── providers/    # React context providers (if needed)
   ├── types.ts      # Domain types
   └── constants.ts  # Feature constants
   ```
3. Only create subdirectories and files that are actually needed — don't create empty placeholder files
4. If the feature needs external API calls:
   - Create a service file in the `api/` directory
   - Add the service type to `ServiceTypes` in `src/app/service-registry.ts`
   - Register the service in `src/app/router.tsx`
   - Create query options in `api/queries.ts`
5. If the feature needs pages:
   - Create page components in `pages/`
   - Create corresponding route files in `src/routes/` (or `src/routes/_authenticated/`)
6. Run `npm run typecheck` and `npm run build` to verify
