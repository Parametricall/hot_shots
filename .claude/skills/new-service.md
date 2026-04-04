---
description: Add a new API service following the service registry pattern
user_invocable: true
---

# New Service

Add a new API service through the service registry.

## Steps

1. Create the service file in `src/features/<feature>/api/<name>.service.ts`:
   - Define Zod schemas for API response DTOs
   - Implement fetch functions that call the external API
   - Map DTOs to domain types
   - Export a `service` object with all public methods

2. Add the service type to `src/app/service-registry.ts`:
   - Add the import type for the service
   - Add the service key and type to `ServiceTypes` interface

3. Register the service in `src/app/router.tsx`:
   - Import the service
   - Call `serviceRegistry.registerService()` at module scope

4. Create query options in the feature's `queries.ts`:
   - Use lazy service access: `const getService = () => ServiceRegistry.getService("serviceName")`
   - Define query options with hierarchical query keys

5. Run `npm run typecheck` and `npm run build` to verify

## Important

- Never import and call third-party fetch functions directly from components
- All DTO-to-domain mapping must happen in the service layer
- Services are accessed via `serviceRegistry.getService()` so they can be mocked in tests
