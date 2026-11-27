import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";

export const SYNC_LOOP_LABEL =
  "Loop: pg_cron posts to the sync endpoint, which loads the sync state and plans due requests; the budgeted Squiggle client fetches them, results are upserted, the run is recorded, and the next run reads that record for backoff and budget.";

export const SYNC_LOOP_CAPTION =
  "Most ticks plan nothing and make no Squiggle request. Off-season that's about two requests a day: next year's Fixture and the Model tips.";

/** The scheduled loop: a cron tick, a planner, a budgeted client, and a record the next tick reads. */
export const SyncLoop = () => (
  <Diagram viewBox="0 0 780 300" label={SYNC_LOOP_LABEL} maxWidth={860}>
    <Box x={10} y={20} width={140} height={60} title="pg_cron" lines={["every 10 minutes"]} />
    <Box
      x={230}
      y={20}
      width={150}
      height={60}
      title="Sync endpoint"
      lines={["checks secret → 202"]}
    />
    <Box
      x={460}
      y={20}
      width={150}
      height={60}
      title="Planner"
      lines={["planSquiggleSync"]}
      mono
      highlighted
    />
    <Box
      x={460}
      y={140}
      width={150}
      height={60}
      title="Squiggle client"
      lines={["≤10/run · ≤300/day"]}
    />
    <Box
      x={670}
      y={140}
      width={100}
      height={60}
      title="Squiggle"
      lines={["Standard API"]}
      external
    />
    <Box
      x={460}
      y={240}
      width={150}
      height={50}
      title="Upsert tables"
      lines={["keeps live scores"]}
    />
    <Box
      x={230}
      y={240}
      width={150}
      height={50}
      title="Record the run"
      lines={["squiggle_sync_runs"]}
      mono
    />

    <Edge x1={150} y1={50} x2={228} y2={50} />
    <EdgeLabel x={189} y={42} anchor="middle">
      POST + secret
    </EdgeLabel>
    <Edge x1={380} y1={50} x2={458} y2={50} />
    <EdgeLabel x={419} y={42} anchor="middle">
      load state
    </EdgeLabel>
    <Edge x1={535} y1={80} x2={535} y2={138} />
    <EdgeLabel x={543} y={114}>
      due requests
    </EdgeLabel>
    <Edge x1={612} y1={170} x2={668} y2={170} both />
    <EdgeLabel x={640} y={162} anchor="middle">
      GET
    </EdgeLabel>
    <Edge x1={535} y1={200} x2={535} y2={238} />
    <EdgeLabel x={543} y={224}>
      results
    </EdgeLabel>
    <Edge x1={460} y1={265} x2={382} y2={265} />
    <Edge d="M305 240 V110 H490 V82" ret />
    <EdgeLabel x={297} y={175} anchor="end">
      next run reads it:
    </EdgeLabel>
    <EdgeLabel x={297} y={190} anchor="end">
      backoff, today&apos;s budget
    </EdgeLabel>
  </Diagram>
);
