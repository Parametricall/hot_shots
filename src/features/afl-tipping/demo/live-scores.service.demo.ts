import type { LiveScoresService } from "~/app/service-registry";

/** The Demo has no live scores: its Games finish when the Demo clock passes them (docs/adr/0004). */
export const liveScoresServiceDemo = {
  subscribe: () => () => {},
} satisfies LiveScoresService;
