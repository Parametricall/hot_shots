import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { DiagramText } from "~/features/architecture/diagrams/diagram-text";

export const TIPPING_LABEL =
  "Flowchart: submitTip enters the Tipster in the Competition if needed, reads the Game and Model tip, refuses if the Game has started, otherwise marks it an Underdog tip if it goes against the Model and saves it.";

export const TIPPING_CAPTION =
  "The rules in judgeTip. A Game that isn't in our tables, or belongs to a different Season, is refused as game-not-found before the diamond.";

/** The decisions `submitTip` makes, from the Competition entry to the saved Tip. */
export const TippingFlow = () => (
  <Diagram viewBox="0 0 760 480" label={TIPPING_LABEL} maxWidth={860}>
    <rect
      x={120}
      y={12}
      width={320}
      height={46}
      rx={8}
      strokeWidth={1.2}
      className="fill-card stroke-border"
    />
    <DiagramText x={280} y={40} anchor="middle" variant="mono">
      submitTip(season, gameId, teamId, margin)
    </DiagramText>
    <Edge x1={280} y1={58} x2={280} y2={82} />
    <Box
      x={120}
      y={84}
      width={320}
      height={52}
      title="Enter the Season's Competition if new"
      lines={["afl_competition_entries · entered_at = now"]}
      centered
    />
    <Edge x1={280} y1={136} x2={280} y2={158} />
    <Box
      x={120}
      y={160}
      width={320}
      height={52}
      title="Read the Game and its Model tip"
      lines={["afl_games · afl_model_tips (our copy)"]}
      centered
    />
    <Edge x1={280} y1={212} x2={280} y2={234} />
    <polygon
      points="280,236 400,276 280,316 160,276"
      strokeWidth={2}
      className="fill-primary/10 stroke-primary"
    />
    <DiagramText x={280} y={281} anchor="middle" variant="title">
      Game started?
    </DiagramText>
    <Edge x1={400} y1={276} x2={518} y2={276} />
    <EdgeLabel x={459} y={268} anchor="middle">
      yes
    </EdgeLabel>
    <Box
      x={520}
      y={250}
      width={220}
      height={52}
      title="Refuse: game-started"
      lines={["Lockout is the first bounce"]}
      centered
      soft
    />
    <Edge x1={280} y1={316} x2={280} y2={338} />
    <EdgeLabel x={290} y={332}>
      no
    </EdgeLabel>
    <Box
      x={120}
      y={340}
      width={320}
      height={52}
      title="Underdog tip = team ≠ Model's pick"
      lines={["neither, if the Model hasn't tipped yet"]}
      centered
    />
    <Edge x1={280} y1={392} x2={280} y2={414} />
    <Box
      x={120}
      y={416}
      width={320}
      height={52}
      title="Upsert the Tip in afl_tipping"
      lines={["season, game, user, team, margin, is_underdog"]}
      centered
    />
  </Diagram>
);
