// Stub for @tanstack/react-start/server. Server-only code should never run in
// the Storybook bundle, but type-graph traversal still resolves the module
// specifier — and the real module pulls in start-server-core, which imports
// the `#tanstack-router-entry` / `#tanstack-start-entry` subpath imports that
// only exist inside a real TanStack Start app build. Give it something
// loadable instead.

export const getCookie = (): string | undefined => undefined;
export const getCookies = (): Record<string, string> => ({});
export const setCookie = (): void => {};
export const deleteCookie = (): void => {};
