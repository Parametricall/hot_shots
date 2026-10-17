/**
 * The one Tipster the Demo signs the visitor in as (docs/adr/0004). Keep it in step
 * with `DEMO_USER` in features/auth/use-current-user.ts; `demo-visitor.test.ts` checks.
 */
export const DEMO_VISITOR = {
  userId: "demo-visitor",
  displayName: "You",
  avatarUrl: null,
} as const;
