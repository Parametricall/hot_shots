import { useUser } from "@clerk/tanstack-react-start";
import { IS_DEMO } from "~/lib/demo";

export type CurrentUser = { id: string; displayName: string; imageUrl: string | null };

// Must match DEMO_VISITOR in features/afl-tipping/demo/demo-visitor.ts (a test checks). It is
// written out here, not imported, because a production bundle keeps any module that is merely
// imported, even if only Demo code uses it.
const DEMO_USER: CurrentUser = { id: "demo-visitor", displayName: "You", imageUrl: null };

/** The signed-in Tipster, or `undefined` while signed out. */
function useClerkCurrentUser(): CurrentUser | undefined {
  const { user } = useUser();
  if (!user) return undefined;
  return {
    id: user.id,
    displayName: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Unknown User",
    imageUrl: user.hasImage ? user.imageUrl : null,
  };
}

/** In the Demo there is no sign-in: the visitor is always "You" (docs/adr/0004). */
function useDemoVisitor(): CurrentUser {
  return DEMO_USER;
}

/**
 * Who is using the site. Chosen when the module loads, so the same hook runs on
 * every render, and so production builds never include the Demo one.
 */
export const useCurrentUser = IS_DEMO ? useDemoVisitor : useClerkCurrentUser;
