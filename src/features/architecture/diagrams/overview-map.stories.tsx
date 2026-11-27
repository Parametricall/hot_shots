import preview, { withRouter } from "#.storybook/preview";
import { OverviewMap } from "~/features/architecture/diagrams/overview-map";
import { darkDecorator, lightDecorator } from "~/features/architecture/diagram/theme-decorators";

const meta = preview.meta({
  component: OverviewMap,
  args: { current: "reading" },
  decorators: [withRouter],
});

export const Reading = meta.story({ args: { current: "reading" }, decorators: [lightDecorator] });

export const SignIn = meta.story({ args: { current: "sign-in" }, decorators: [lightDecorator] });

export const Tipping = meta.story({ args: { current: "tipping" }, decorators: [lightDecorator] });

export const Scoring = meta.story({ args: { current: "scoring" }, decorators: [lightDecorator] });

export const SquiggleSync = meta.story({
  args: { current: "squiggle-sync" },
  decorators: [lightDecorator],
});

export const LiveScores = meta.story({
  args: { current: "live-scores" },
  decorators: [lightDecorator],
});

export const Security = meta.story({ args: { current: "security" }, decorators: [lightDecorator] });

export const Demo = meta.story({ args: { current: "demo" }, decorators: [lightDecorator] });

export const ReadingDark = meta.story({
  args: { current: "reading" },
  decorators: [darkDecorator],
});

export const LiveScoresDark = meta.story({
  args: { current: "live-scores" },
  decorators: [darkDecorator],
});

export const SecurityDark = meta.story({
  args: { current: "security" },
  decorators: [darkDecorator],
});
