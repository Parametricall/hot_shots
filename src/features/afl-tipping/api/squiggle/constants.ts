export const SQUIGGLE_HOST = "https://squiggle.com.au";
export const SQUIGGLE_API_HOST = "https://api.squiggle.com.au";

// Squiggle asks callers to identify themselves. The User-Agent is this name plus the contact email
// from SQUIGGLE_CONTACT_EMAIL (see user-agent.ts).
export const SQUIGGLE_USER_AGENT_NAME = "Hot Shots Tipping (hot-shots.dev)";

// Squiggle's Event API (SSE). It allowlists browser origins, so the browser reaches it through
// our own /api/live-scores route, never directly.
export const SQUIGGLE_SSE_HOST = "https://sse.squiggle.com.au";
