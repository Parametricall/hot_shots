---
description: Run full verification suite (typecheck, build, lint, test)
user_invocable: true
---

# Verify

Run the full verification suite to ensure the project is in a good state.

## Steps

1. Run all checks in sequence, stopping on first failure:
   - `npm run typecheck` — TypeScript type checking
   - `npm run build` — Production build (vite build + tsc)
   - `npm run lint` — ESLint
   - `npm run test` — Vitest tests
2. Report the results concisely
3. If any check fails, diagnose and fix the issue, then re-run from the failed step
