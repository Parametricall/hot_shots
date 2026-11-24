import preview, { containerDecorator, withSeason } from "#.storybook/preview";
import type { Decorator } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { PastSeasonBanner } from "~/features/afl-tipping/components/past-season-banner";
import { SeasonMoreMenu } from "~/features/afl-tipping/components/season-more-menu";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { Seasons } from "~/features/afl-tipping/utils/afl-season";

/** Seeds the list of Seasons on the story's client. */
const withSeasons = (seasons: Seasons): Decorator =>
  function WithSeasons(Story) {
    const queryClient = useQueryClient();
    queryClient.setQueryData(aflQueries.seasonsKey(), seasons);
    return <Story />;
  };

const TWO_SEASONS: Seasons = {
  seasons: [2027, 2026],
  current: { season: 2027, status: "in-progress", firstGameAt: 0 },
};

/** The Season switcher lives in the More sheet: open it to see the Seasons. */
const meta = preview.meta({
  component: SeasonMoreMenu,
  parameters: { layout: "padded" },
});

export const OnTheCurrentSeason = meta.story({
  args: { season: 2027, activeTab: "leaderboard", variant: "button" },
  decorators: [withSeason(2027), withSeasons(TWO_SEASONS), containerDecorator("max-w-md")],
});

export const OnAPastSeason = meta.story({
  args: { season: 2026, activeTab: "leaderboard", variant: "button" },
  decorators: [withSeason(2026), withSeasons(TWO_SEASONS), containerDecorator("max-w-md")],
});

export const WithOneSeason = meta.story({
  args: { season: 2026, activeTab: "leaderboard", variant: "button" },
  decorators: [
    withSeason(2026),
    withSeasons({
      seasons: [2026],
      current: { season: 2026, status: "in-progress", firstGameAt: 0 },
    }),
  ],
});

export const BannerOnAPastSeason = meta.story({
  args: { season: 2026, activeTab: "leaderboard", variant: "button" },
  render: () => <PastSeasonBanner />,
  decorators: [withSeason(2026), withSeasons(TWO_SEASONS), containerDecorator("max-w-md")],
});

export const BannerWhenCurrentSeasonIsOver = meta.story({
  args: { season: 2025, activeTab: "leaderboard", variant: "button" },
  render: () => <PastSeasonBanner />,
  decorators: [
    withSeason(2025),
    withSeasons({
      seasons: [2026, 2025],
      current: { season: 2026, status: "over", firstGameAt: 0 },
    }),
    containerDecorator("max-w-md"),
  ],
});
