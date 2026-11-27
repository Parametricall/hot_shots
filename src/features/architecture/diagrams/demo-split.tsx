import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { DiagramText } from "~/features/architecture/diagrams/diagram-text";

export const DEMO_LABEL =
  "Comparison: the same pages and queries ask the service registry for services; the live site registers services backed by server functions, Supabase and Realtime, while the Demo registers services backed by a bundled snapshot, a Demo clock and a no-op live score service.";

export const DEMO_CAPTION =
  "The swap happens in one place. The Demo's Games finish as the Demo clock passes them, so the visitor plays through a whole Season against made-up Tipsters.";

const LANE_LABEL = "fill-muted-foreground font-mono text-[10.5px] tracking-widest";

/** The live site and the Demo, split at the service registry. */
export const DemoSplit = () => (
  <Diagram viewBox="0 0 780 270" label={DEMO_LABEL} maxWidth={860}>
    <Box
      x={240}
      y={10}
      width={300}
      height={46}
      title="Same pages, hooks and queries"
      lines={["nothing here knows which site it is"]}
      centered
    />
    <Edge x1={390} y1={56} x2={390} y2={84} />
    <Box x={290} y={86} width={200} height={44} title="Service registry" centered highlighted />
    <Edge d="M330 130 V150 H170 V168" />
    <EdgeLabel x={250} y={144} anchor="middle">
      router.tsx registers
    </EdgeLabel>
    <Edge d="M450 130 V150 H610 V168" />
    <EdgeLabel x={530} y={144} anchor="middle">
      start-demo.ts registers
    </EdgeLabel>

    <DiagramText x={20} y={186} className={LANE_LABEL}>
      LIVE SITE
    </DiagramText>
    <Box x={20} y={194} width={300} height={32} title="Games → server functions → tables" />
    <Box x={20} y={232} width={300} height={32} title="Live scores → Supabase Realtime" />

    <DiagramText x={460} y={186} className={LANE_LABEL}>
      DEMO · VITE_DEMO=true
    </DiagramText>
    <Box x={460} y={194} width={300} height={32} title="Games → bundled Season snapshot" />
    <Box x={460} y={232} width={300} height={32} title="Live scores → no-op; the Demo clock" />
  </Diagram>
);
