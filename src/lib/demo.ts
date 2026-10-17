/**
 * True in the Demo build (`VITE_DEMO=true`, docs/adr/0004). Vite replaces
 * `import.meta.env.VITE_DEMO` while building, so production builds are false.
 *
 * Use it for plain checks. To gate an import of Demo-only code, write
 * `import.meta.env.VITE_DEMO === "true"` out where the import is: Vite can fold
 * that where it stands, but not a constant imported from here until after the
 * bundler has chunked, so the Demo code would still be emitted for production.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === "true";
