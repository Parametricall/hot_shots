import * as z from "zod";
import { TOPIC_IDS } from "~/features/architecture/topics";

/**
 * The Architecture page's search params. An unknown or missing `topic` falls back to `reading`,
 * so a stale or hand-typed link still opens the page instead of an error. `.optional()` keeps
 * `topic` out of the required input, so a `Link` to `/architecture` needs no `search`.
 */
export const architectureSearchSchema = z.object({
  topic: z.enum(TOPIC_IDS).optional().catch("reading").default("reading"),
});
