/**
 * True in the Demo build (`VITE_DEMO=true`, docs/adr/0004). Vite replaces the
 * value while building, so code behind `if (IS_DEMO)` is dropped from
 * production bundles.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === "true";
