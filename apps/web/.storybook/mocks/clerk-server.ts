// Stub for @clerk/tanstack-react-start/server. Server-only code should never
// run in the Storybook bundle, but type-graph traversal still resolves the
// module specifier — so we give it something loadable.

export const auth = async () => ({ userId: "user-storybook" });
export const clerkMiddleware = () => () => {};
