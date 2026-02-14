import preview, { containerDecorator } from "#.storybook/preview";
import { GameCard } from "~/features/afl-tipping/components/game-card";
import { createAflGame, createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";
import { formatDateHeader } from "~/features/afl-tipping/utils";
import { AflGame } from "~/features/afl-tipping/types";

const teams = [
  createAflTeam({ id: 1, ...fakeTeams.lions }),
  createAflTeam({ id: 2, ...fakeTeams.suns }),
  createAflTeam({ id: 3, ...fakeTeams.COL }),
  createAflTeam({ id: 4, ...fakeTeams.ESS }),
];

// Create games across multiple days with several per day to force scrolling
const day1 = new Date(2025, 3, 5, 14, 0); // Saturday
const day2 = new Date(2025, 3, 6, 13, 0); // Sunday
const day3 = new Date(2025, 3, 7, 19, 0); // Monday

const day1Games = [
  createAflGame({ id: 1, homeTeamId: 1, awayTeamId: 2, date: new Date(day1), unixTime: day1.getTime() }),
  createAflGame({ id: 2, homeTeamId: 3, awayTeamId: 4, date: new Date(day1.getTime() + 3600000), unixTime: day1.getTime() + 3600000 }),
  createAflGame({ id: 3, homeTeamId: 2, awayTeamId: 3, date: new Date(day1.getTime() + 7200000), unixTime: day1.getTime() + 7200000 }),
];

const day2Games = [
  createAflGame({ id: 4, homeTeamId: 4, awayTeamId: 1, date: new Date(day2), unixTime: day2.getTime() }),
  createAflGame({ id: 5, homeTeamId: 1, awayTeamId: 3, date: new Date(day2.getTime() + 3600000), unixTime: day2.getTime() + 3600000 }),
  createAflGame({ id: 6, homeTeamId: 2, awayTeamId: 4, date: new Date(day2.getTime() + 7200000), unixTime: day2.getTime() + 7200000 }),
];

const day3Games = [
  createAflGame({ id: 7, homeTeamId: 3, awayTeamId: 1, date: new Date(day3), unixTime: day3.getTime() }),
  createAflGame({ id: 8, homeTeamId: 4, awayTeamId: 2, date: new Date(day3.getTime() + 3600000), unixTime: day3.getTime() + 3600000 }),
];

const allGames: Record<string, AflGame[]> = {
  [day1.toISOString().split("T")[0]]: day1Games,
  [day2.toISOString().split("T")[0]]: day2Games,
  [day3.toISOString().split("T")[0]]: day3Games,
};

function StickyDatesLayout() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(allGames).map(([date, games]) => (
        <div key={date} className="space-y-2 sm:space-y-3">
          <h3 className="text-base sm:text-lg font-semibold text-muted-foreground border-b pb-1 sm:pb-2 sticky top-0 bg-background z-10 pt-2">
            {formatDateHeader(date)}
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                homeTeam={teams.find((t) => t.id === game.homeTeamId) ?? teams[0]}
                awayTeam={teams.find((t) => t.id === game.awayTeamId) ?? teams[1]}
                onTipSelect={() => {}}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const mockSquiggleService = {
  getGames: () => Promise.resolve([]),
};

const meta = preview.meta({
  component: StickyDatesLayout,
  parameters: {
    layout: "padded",
    services: { squiggleService: mockSquiggleService },
  },
  decorators: [containerDecorator("max-w-xl")],
});

export const Default = meta.story({
  tags: ["demo"],
});

export const Mobile = meta.story({
  decorators: [containerDecorator("max-w-[375px]")],
});

export const SmallTablet = meta.story({
  decorators: [containerDecorator("max-w-[600px]")],
});
