import { createStart } from "@tanstack/react-start";

// No request middleware: the session is read, and refreshed, by `getSessionUserId` in the
// handlers that need it (docs/adr/0006).
export const startInstance = createStart(() => ({}));
