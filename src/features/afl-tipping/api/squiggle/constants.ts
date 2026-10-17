export const SQUIGGLE_HOST = "https://squiggle.com.au";
export const SQUIGGLE_API_HOST = "https://api.squiggle.com.au";

// Squiggle asks callers to identify themselves.
export const SQUIGGLE_USER_AGENT = "Alex's Tipping App - parametricall@users.noreply.github.com";

// Squiggle's Event API (SSE). It allowlists browser origins, so the browser reaches it through
// our own /api/live-scores route, never directly.
export const SQUIGGLE_SSE_HOST = "https://sse.squiggle.com.au";
