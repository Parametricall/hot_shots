import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart } from "@tanstack/react-start";
import { IS_DEMO } from "~/lib/demo";

export const startInstance = createStart(() => {
  return {
    // The Demo has no sign-in and no Clerk keys (docs/adr/0004).
    requestMiddleware: IS_DEMO ? [] : [clerkMiddleware()],
  };
});
