import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { Activation, Lifeline } from "~/features/architecture/diagram/lifeline";
import { DiagramText } from "~/features/architecture/diagrams/diagram-text";

export const READING_LABEL =
  "Sequence: the browser shows cached Games, refetches them through a server function if they're over a minute old, the server checks the session and reads afl_games, and the browser saves the result to localStorage.";

export const READING_CAPTION =
  "One page load. The page is on screen at step 1. Steps 2–6 only run when the cached Games are over a minute old, and they never reach Squiggle.";

/** One page load: the cache answers first, then a server function refreshes it from our tables. */
export const ReadingSequence = () => (
  <Diagram viewBox="0 0 780 342" label={READING_LABEL} maxWidth={860}>
    <Box x={40} y={8} width={140} height={36} title="Browser" centered />
    <Box x={310} y={8} width={160} height={36} title="Server function" centered />
    <Box x={600} y={8} width={140} height={36} title="Supabase" centered />
    <Lifeline x={110} y1={44} y2={334} />
    <Lifeline x={390} y1={44} y2={334} />
    <Lifeline x={670} y1={44} y2={334} />

    <Activation x={110} y={62} height={28} />
    <DiagramText x={124} y={81}>
      1. Shows the cached Games at once
    </DiagramText>
    <Edge x1={116} y1={122} x2={382} y2={122} />
    <EdgeLabel x={250} y={114} anchor="middle">
      2. Refetch if over a minute old
    </EdgeLabel>
    <Edge x1={396} y1={162} x2={662} y2={162} />
    <EdgeLabel x={530} y={154} anchor="middle">
      3. getClaims(): is the session valid?
    </EdgeLabel>
    <Edge x1={396} y1={202} x2={662} y2={202} />
    <EdgeLabel x={530} y={194} anchor="middle">
      4. Read afl_games with the secret key
    </EdgeLabel>
    <Edge x1={664} y1={242} x2={398} y2={242} ret />
    <EdgeLabel x={530} y={234} anchor="middle">
      rows
    </EdgeLabel>
    <Edge x1={384} y1={282} x2={118} y2={282} ret />
    <EdgeLabel x={250} y={274} anchor="middle">
      5. Games, mapped to AflGame
    </EdgeLabel>
    <Activation x={110} y={302} height={28} />
    <DiagramText x={124} y={321}>
      6. Saves it to localStorage (24 h)
    </DiagramText>
  </Diagram>
);
