import { Diagram } from "~/features/architecture/diagram/diagram";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { DiagramText } from "~/features/architecture/diagrams/diagram-text";
import { cn } from "~/lib/utils";

export const LIVE_TIMELINE_LABEL =
  "Timeline over 15 minutes: pg_cron ticks every minute, and the ticks at 0, 5 and 10 minutes start runs that last 290 seconds each, leaving a gap of about 10 seconds between runs.";

export const LIVE_TIMELINE_CAPTION =
  "Fifteen minutes of a live Game. Filled ticks start a run. Hollow ticks find the lease held and do nothing. Each run stops at 290 seconds, just short of five minutes, and the next tick starts the next one. On connect, Squiggle sends each live Game's current state, which covers the gap.";

const AXIS_START = 60;
const MINUTE = (740 - AXIS_START) / 15;
const TICKS = Array.from({ length: 16 }, (_, minute) => ({
  minute,
  x: AXIS_START + minute * MINUTE,
  startsRun: minute % 5 === 0,
}));
const RUNS = [
  { label: "run 1 · one connection", start: 0 },
  { label: "run 2 · reconnect", start: 5 },
  { label: "run 3", start: 10 },
].map((run) => ({ ...run, x: AXIS_START + run.start * MINUTE }));
// A run lasts 290 s of the 300 s between ticks.
const RUN_WIDTH = (MINUTE * 5 * 290) / 300;

/** Fifteen minutes of cron ticks and ingest runs, showing the lease and the ~10 s gap. */
export const LiveTimeline = () => (
  <Diagram viewBox="0 0 800 190" label={LIVE_TIMELINE_LABEL} maxWidth={860}>
    <EdgeLabel x={52} y={44} anchor="end">
      pg_cron
    </EdgeLabel>
    <EdgeLabel x={52} y={98} anchor="end">
      ingest
    </EdgeLabel>
    <line
      x1={60}
      y1={150}
      x2={740}
      y2={150}
      strokeWidth={1.2}
      className="stroke-muted-foreground"
    />
    {TICKS.map((tick) => (
      <circle
        key={tick.minute}
        cx={tick.x}
        cy={40}
        r={5}
        strokeWidth={1.3}
        className={cn(
          tick.startsRun ? "fill-primary stroke-primary" : "fill-card stroke-muted-foreground",
        )}
      />
    ))}
    {RUNS.map((run) => (
      <line
        key={run.start}
        x1={run.x}
        y1={46}
        x2={run.x}
        y2={82}
        strokeWidth={1.2}
        className="stroke-border [stroke-dasharray:3_4]"
      />
    ))}
    {RUNS.map((run) => (
      <g key={run.label}>
        <rect
          x={run.x}
          y={82}
          width={RUN_WIDTH}
          height={28}
          rx={4}
          strokeWidth={1.2}
          className="fill-primary/10 stroke-primary"
        />
        <DiagramText x={run.x + 12} y={101}>
          {run.label}
        </DiagramText>
      </g>
    ))}
    <EdgeLabel x={283} y={130} anchor="middle">
      ~10 s gap
    </EdgeLabel>
    <EdgeLabel x={509.5} y={130} anchor="middle">
      ~10 s gap
    </EdgeLabel>
    <DiagramText x={60} y={170} anchor="middle" variant="sub">
      0
    </DiagramText>
    <DiagramText x={AXIS_START + 5 * MINUTE} y={170} anchor="middle" variant="sub">
      5 min
    </DiagramText>
    <DiagramText x={AXIS_START + 10 * MINUTE} y={170} anchor="middle" variant="sub">
      10 min
    </DiagramText>
    <DiagramText x={740} y={170} anchor="middle" variant="sub">
      15 min
    </DiagramText>
  </Diagram>
);
