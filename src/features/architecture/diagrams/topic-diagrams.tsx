import type { ComponentType } from "react";
import { DemoSplit, DEMO_CAPTION } from "~/features/architecture/diagrams/demo-split";
import { LiveFlow, LIVE_FLOW_CAPTION } from "~/features/architecture/diagrams/live-flow";
import {
  LiveTimeline,
  LIVE_TIMELINE_CAPTION,
} from "~/features/architecture/diagrams/live-timeline";
import {
  ReadingSequence,
  READING_CAPTION,
} from "~/features/architecture/diagrams/reading-sequence";
import { ScoringFlow, SCORING_CAPTION } from "~/features/architecture/diagrams/scoring-flow";
import {
  SecurityBoundaries,
  SECURITY_CAPTION,
} from "~/features/architecture/diagrams/security-boundaries";
import { SignInSequence, SIGN_IN_CAPTION } from "~/features/architecture/diagrams/sign-in-sequence";
import { SyncLoop, SYNC_LOOP_CAPTION } from "~/features/architecture/diagrams/sync-loop";
import { TippingFlow, TIPPING_CAPTION } from "~/features/architecture/diagrams/tipping-flow";
import type { TopicId } from "~/features/architecture/topics";

export type TopicDiagram = {
  Diagram: ComponentType;
  /** The figcaption that sits under the diagram. */
  caption: string;
};

/**
 * The diagrams each Topic shows, in order. Live scores has two. `squiggle-sync` also has the
 * `SyncCadenceTable`, which the page renders beside its steps.
 */
export const TOPIC_DIAGRAMS: Record<TopicId, readonly TopicDiagram[]> = {
  reading: [{ Diagram: ReadingSequence, caption: READING_CAPTION }],
  "sign-in": [{ Diagram: SignInSequence, caption: SIGN_IN_CAPTION }],
  tipping: [{ Diagram: TippingFlow, caption: TIPPING_CAPTION }],
  scoring: [{ Diagram: ScoringFlow, caption: SCORING_CAPTION }],
  "squiggle-sync": [{ Diagram: SyncLoop, caption: SYNC_LOOP_CAPTION }],
  "live-scores": [
    { Diagram: LiveFlow, caption: LIVE_FLOW_CAPTION },
    { Diagram: LiveTimeline, caption: LIVE_TIMELINE_CAPTION },
  ],
  security: [{ Diagram: SecurityBoundaries, caption: SECURITY_CAPTION }],
  demo: [{ Diagram: DemoSplit, caption: DEMO_CAPTION }],
};
