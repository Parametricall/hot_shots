import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";

export const SCORING_LABEL =
  "Data flow: stored Tips, competition entries and Games produce Auto-tips; Tips plus Auto-tips and Games are scored; the scores and Tipster profiles are ranked into the Leaderboard.";

export const SCORING_CAPTION =
  "What buildLeaderboard does on each request. Group tips and player stats run the same Auto-tip step first, so every page agrees.";

/** Four stored inputs, two steps and a ranking: how a request becomes a Leaderboard. */
export const ScoringFlow = () => (
  <Diagram viewBox="0 0 760 290" label={SCORING_LABEL} maxWidth={860}>
    <Box x={20} y={20} width={180} height={44} title="Stored Tips" lines={["afl_tipping"]} mono />
    <Box
      x={20}
      y={84}
      width={180}
      height={44}
      title="Competition entries"
      lines={["when each Tipster entered"]}
    />
    <Box x={20} y={148} width={180} height={44} title="Games" lines={["start times, winners"]} />
    <Box x={20} y={236} width={180} height={44} title="Profiles" lines={["names and photos"]} />

    <Box
      x={270}
      y={52}
      width={200}
      height={66}
      title="withAutoTips"
      lines={["Home team for each missed", "Game after Lockout"]}
      highlighted
    />
    <Box
      x={270}
      y={160}
      width={200}
      height={66}
      title="scoreTips"
      lines={["Correct tips · Margin", "difference on Margin game"]}
    />
    <Box
      x={540}
      y={110}
      width={200}
      height={70}
      title="assembleLeaderboard"
      lines={["by Score, then lowest", "Margin difference; ties share"]}
    />

    <Edge x1={200} y1={42} x2={268} y2={68} />
    <Edge x1={200} y1={106} x2={268} y2={90} />
    <Edge x1={200} y1={164} x2={268} y2={104} />
    <Edge x1={200} y1={178} x2={268} y2={186} />
    <Edge x1={370} y1={118} x2={370} y2={158} />
    <EdgeLabel x={378} y={140}>
      Tips + Auto-tips
    </EdgeLabel>
    <Edge x1={470} y1={190} x2={538} y2={160} />
    <Edge d="M200 258 H640 V182" />
  </Diagram>
);
