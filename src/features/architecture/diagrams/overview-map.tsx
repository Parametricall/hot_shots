import { Link } from "@tanstack/react-router";
import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { Lane } from "~/features/architecture/diagram/lane";
import { DiagramText } from "~/features/architecture/diagrams/diagram-text";
import type { TopicId } from "~/features/architecture/topics";

type OverviewMapProps = {
  /** The Topic being read: its nodes and edges light up. */
  current: TopicId;
};

export const OVERVIEW_LABEL =
  "System map: the browser talks only to the site's Vercel server and, during Games, to Supabase Realtime. The server reads and writes Supabase with the secret key. Only the sync and live ingest call Squiggle, started by pg_cron in Supabase.";

export const OVERVIEW_CAPTION =
  "The browser only ever talks to the site's own server, plus a Realtime WebSocket during Games. Only the two sync endpoints call Squiggle, and Supabase's own scheduler starts them. Every other read comes from the site's own tables.";

type NodeProps = {
  /** Where the link goes: the first Topic the node belongs to. */
  to: TopicId;
  /** Every Topic that lights the node up. */
  topics: readonly TopicId[];
  current: TopicId;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  lines: string[];
  mono?: boolean;
  external?: boolean;
};

const Node = ({ to, topics, current, ...box }: NodeProps) => (
  <Link
    to="/architecture"
    search={{ topic: to }}
    className="group/node cursor-pointer outline-none"
    aria-label={`${box.title}: ${box.lines.join(", ")}`}
  >
    <Box {...box} highlighted={topics.includes(current)} />
  </Link>
);

/**
 * The system on one page: four lanes (browser, the server, the database, Squiggle) and the paths
 * between them. Every node links to the Topic that explains it, and the current Topic's nodes and
 * edges are drawn in the primary color.
 */
export const OverviewMap = ({ current }: OverviewMapProps) => {
  const hot = (...topics: TopicId[]) => topics.includes(current);
  const node = { current } as const;

  return (
    <Diagram viewBox="0 0 1000 680" label={OVERVIEW_LABEL} minWidth={780} role="group">
      <Lane x={10} y={110} width={250} height={560} label="BROWSER" />
      <Lane x={320} y={110} width={360} height={350} label="VERCEL · TANSTACK START" />
      <Lane x={740} y={110} width={250} height={560} label="SUPABASE" />
      <Lane
        x={320}
        y={470}
        width={360}
        height={100}
        label="SQUIGGLE · EXTERNAL"
        external
        labelAtBottom
      />
      <DiagramText x={10} y={40} className="fill-muted-foreground font-mono text-[10.5px]">
        Click a box for detail.
      </DiagramText>
      <DiagramText x={10} y={58} className="fill-muted-foreground font-mono text-[10.5px]">
        Dark outline = the topic you&apos;re reading.
      </DiagramText>

      <Edge x1={135} y1={208} x2={135} y2={258} both highlighted={hot("reading")} />
      <EdgeLabel x={143} y={238} on="lane">
        persist / restore
      </EdgeLabel>

      <Edge d="M240 272 H262 V178 H338" highlighted={hot("sign-in")} />
      <EdgeLabel x={268} y={226}>
        sign in
      </EdgeLabel>
      <Edge x1={660} y1={178} x2={758} y2={178} highlighted={hot("sign-in")} />
      <EdgeLabel x={710} y={170} anchor="middle">
        session
      </EdgeLabel>

      <Edge
        x1={240}
        y1={300}
        x2={338}
        y2={300}
        highlighted={hot("reading", "tipping", "scoring")}
      />
      <EdgeLabel x={289} y={293} anchor="middle">
        calls
      </EdgeLabel>
      <Edge
        x1={340}
        y1={316}
        x2={242}
        y2={316}
        ret
        highlighted={hot("reading", "tipping", "scoring")}
      />
      <EdgeLabel x={289} y={332} anchor="middle">
        data
      </EdgeLabel>

      <Edge
        x1={662}
        y1={292}
        x2={758}
        y2={292}
        both
        highlighted={hot("reading", "tipping", "scoring", "security")}
      />
      <EdgeLabel x={710} y={284} anchor="middle">
        secret key
      </EdgeLabel>

      <Edge x1={760} y1={425} x2={668} y2={425} highlighted={hot("squiggle-sync", "live-scores")} />
      <EdgeLabel x={714} y={417} anchor="middle">
        POST + secret
      </EdgeLabel>
      <Edge d="M668 398 H712 V322 H758" highlighted={hot("squiggle-sync", "live-scores")} />
      <EdgeLabel x={706} y={364} anchor="end">
        upserts
      </EdgeLabel>

      <Edge x1={419} y1={446} x2={419} y2={492} highlighted={hot("squiggle-sync")} />
      <EdgeLabel x={427} y={482}>
        ≤100 req/day
      </EdgeLabel>
      <Edge x1={582} y1={446} x2={582} y2={492} highlighted={hot("live-scores")} />
      <EdgeLabel x={589} y={482}>
        1 stream
      </EdgeLabel>

      <Edge x1={945} y1={340} x2={945} y2={588} highlighted={hot("live-scores")} />
      <EdgeLabel x={937} y={475} anchor="end" on="lane">
        trigger
      </EdgeLabel>
      <Edge x1={758} y1={618} x2={242} y2={618} highlighted={hot("live-scores")} />
      <EdgeLabel x={500} y={610} anchor="middle">
        pushes live-game · WebSocket
      </EdgeLabel>
      <Edge x1={135} y1={590} x2={135} y2={326} highlighted={hot("live-scores")} />
      <EdgeLabel x={143} y={462} on="lane">
        updates Games
      </EdgeLabel>

      <Node
        {...node}
        to="reading"
        topics={["reading"]}
        x={30}
        y={150}
        width={210}
        height={56}
        title="Query cache"
        lines={["localStorage · kept 24 h"]}
      />
      <Node
        {...node}
        to="reading"
        topics={["reading", "tipping", "scoring", "demo"]}
        x={30}
        y={260}
        width={210}
        height={64}
        title="Pages"
        lines={["React + TanStack Query"]}
      />
      <Node
        {...node}
        to="live-scores"
        topics={["live-scores"]}
        x={30}
        y={590}
        width={210}
        height={56}
        title="Live scores client"
        lines={["joins Realtime, signed in"]}
      />

      <Node
        {...node}
        to="sign-in"
        topics={["sign-in"]}
        x={340}
        y={150}
        width={320}
        height={56}
        title="Auth routes"
        lines={["/sign-in · /auth/oauth · /auth/callback"]}
      />
      <Node
        {...node}
        to="tipping"
        topics={["tipping", "scoring", "reading"]}
        x={340}
        y={260}
        width={320}
        height={64}
        title="Server functions"
        lines={["Tips · Leaderboard · Games · Seasons"]}
      />
      <rect
        x={334}
        y={382}
        width={332}
        height={72}
        rx={10}
        className="fill-none stroke-border [stroke-dasharray:4_4]"
      />
      <Node
        {...node}
        to="squiggle-sync"
        topics={["squiggle-sync"]}
        x={344}
        y={390}
        width={150}
        height={56}
        title="Squiggle sync"
        lines={["api/sync/squiggle"]}
        mono
      />
      <Node
        {...node}
        to="live-scores"
        topics={["live-scores"]}
        x={504}
        y={390}
        width={156}
        height={56}
        title="Live ingest"
        lines={["api/sync/live-scores"]}
        mono
      />

      <Node
        {...node}
        to="squiggle-sync"
        topics={["squiggle-sync"]}
        x={344}
        y={494}
        width={150}
        height={50}
        title="Standard API"
        lines={["games · tips · ladder"]}
        external
      />
      <Node
        {...node}
        to="live-scores"
        topics={["live-scores"]}
        x={504}
        y={494}
        width={156}
        height={50}
        title="Event API (SSE)"
        lines={["sse.squiggle.com.au"]}
        external
      />

      <Node
        {...node}
        to="sign-in"
        topics={["sign-in", "security"]}
        x={760}
        y={150}
        width={210}
        height={56}
        title="Supabase Auth"
        lines={["invite-only · Google or code"]}
      />
      <Node
        {...node}
        to="security"
        topics={["security", "reading", "tipping", "scoring", "squiggle-sync"]}
        x={760}
        y={260}
        width={210}
        height={80}
        title="Tables"
        lines={["afl_tipping, afl_games, …", "RLS on, no policies"]}
      />
      <Node
        {...node}
        to="squiggle-sync"
        topics={["squiggle-sync", "live-scores"]}
        x={760}
        y={398}
        width={160}
        height={56}
        title="pg_cron + pg_net"
        lines={["calls the endpoints"]}
      />
      <Node
        {...node}
        to="live-scores"
        topics={["live-scores", "security"]}
        x={760}
        y={590}
        width={210}
        height={56}
        title="Realtime"
        lines={["channel afl:live-games"]}
        mono
      />
    </Diagram>
  );
};
