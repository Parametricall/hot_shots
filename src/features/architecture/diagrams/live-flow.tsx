import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";

export const LIVE_FLOW_LABEL =
  "Flow: Squiggle's Event API streams events to the live ingest, which updates afl_games; a trigger sends each change to Realtime, which pushes it to every open tab.";

export const LIVE_FLOW_CAPTION =
  "One goal, end to end. The trigger only fires when one of the five live fields changes: home score, away score, game clock, completion or winner.";

/** One goal, from Squiggle's event stream to every open tab. */
export const LiveFlow = () => (
  <Diagram viewBox="0 0 800 210" label={LIVE_FLOW_LABEL} maxWidth={860}>
    <Box
      x={160}
      y={10}
      width={200}
      height={46}
      title="pg_cron"
      lines={["each minute, if a Game is on"]}
    />
    <Edge x1={265} y1={56} x2={265} y2={104} />
    <EdgeLabel x={273} y={86}>
      POST, if lease free
    </EdgeLabel>
    <Box
      x={10}
      y={106}
      width={140}
      height={56}
      title="Event API"
      lines={["goals, clock, result"]}
      external
    />
    <Box
      x={180}
      y={106}
      width={170}
      height={56}
      title="Live ingest"
      lines={["≤ 290 s a run · lease"]}
      highlighted
    />
    <Box x={400} y={106} width={120} height={56} title="afl_games" lines={["5 live fields"]} />
    <Box x={570} y={106} width={110} height={56} title="Realtime" lines={["afl:live-games"]} mono />
    <Box x={720} y={80} width={70} height={30} title="Tab" centered />
    <Box x={720} y={119} width={70} height={30} title="Tab" centered />
    <Box x={720} y={158} width={70} height={30} title="Tab" centered />
    <Edge x1={150} y1={134} x2={178} y2={134} />
    <EdgeLabel x={164} y={126} anchor="middle">
      SSE
    </EdgeLabel>
    <Edge x1={350} y1={134} x2={398} y2={134} />
    <EdgeLabel x={374} y={126} anchor="middle">
      update
    </EdgeLabel>
    <Edge x1={520} y1={134} x2={568} y2={134} />
    <EdgeLabel x={544} y={126} anchor="middle">
      trigger
    </EdgeLabel>
    <Edge x1={680} y1={128} x2={718} y2={97} />
    <Edge x1={680} y1={134} x2={718} y2={134} />
    <Edge x1={680} y1={140} x2={718} y2={171} />
  </Diagram>
);
