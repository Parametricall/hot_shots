import preview, { withRouter } from "#.storybook/preview";
import { SeasonBottomBar } from "~/features/afl-tipping/components/season-bottom-bar";

const meta = preview.meta({
  component: SeasonBottomBar,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile1" } },
  decorators: [withRouter],
});

export const OnTips = meta.story({ args: { season: 2026, activeTab: "tips" } });

export const OnLeaderboard = meta.story({ args: { season: 2026, activeTab: "leaderboard" } });

/** On the Season summary no section is current. */
export const OnTheSeasonSummary = meta.story({ args: { season: 2026, activeTab: "summary" } });
