import preview, { centeredYDecorator, containerDecorator } from "#.storybook/preview";
import { GroupTipsList } from "~/features/afl-tipping/components/group-tips-list";
import {
  createAflGame,
  createAflGroupTipEntry,
  createAflTeam,
  fakeTeams,
} from "~/features/afl-tipping/mocks/factories";
import { AflGame, AflGroupTipEntry } from "~/features/afl-tipping/types";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import type { Decorator } from "@storybook/react-vite";
import { VENUES } from "~/features/afl-tipping/constants";

const withCurrentRound = (round: number): Decorator => {
  return function Decorator(Story) {
    return (
      <CurrentRoundProvider state={round}>
        <Story />
      </CurrentRoundProvider>
    );
  };
};

const teams = [
  createAflTeam({ id: 1, ...fakeTeams.lions }),
  createAflTeam({ id: 2, ...fakeTeams.suns }),
  createAflTeam({ id: 3, ...fakeTeams.COL }),
  createAflTeam({ id: 4, ...fakeTeams.ESS }),
];

const pastTime = Date.now() - 1000 * 60 * 60 * 2; // 2 hours ago
const futureTime = Date.now() + 1000 * 60 * 60 * 24; // 24 hours from now

const startedGame = createAflGame({
  id: 100,
  round: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  unixTime: pastTime,
  date: new Date(pastTime),
  homeScore: 42,
  awayScore: 35,
  complete: 0,
  venue: VENUES.gabba,
});

const completedGame = createAflGame({
  id: 100,
  round: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  unixTime: pastTime,
  date: new Date(pastTime),
  homeScore: 82,
  awayScore: 65,
  complete: 100,
  winnerTeamId: 1,
  venue: VENUES.gabba,
});

const upcomingGame = createAflGame({
  id: 101,
  round: 1,
  homeTeamId: 3,
  awayTeamId: 4,
  unixTime: futureTime,
  date: new Date(futureTime),
  venue: VENUES.mcg,
});

const mockUsers = {
  alice: { userId: "user-1", displayName: "Alice Johnson", avatarUrl: "/dummy-footy-logo.png" },
  bob: { userId: "user-2", displayName: "Bob Williams", avatarUrl: "/dummy-footy-logo.png" },
  charlie: { userId: "user-3", displayName: "Charlie Brown", avatarUrl: null },
  diana: { userId: "user-4", displayName: "Diana Prince", avatarUrl: "/dummy-footy-logo.png" },
  eve: { userId: "user-5", displayName: "Eve Martinez", avatarUrl: null },
};

function buildServices(games: AflGame[], groupTips: AflGroupTipEntry[]) {
  return {
    squiggleService: {
      getGames: () => Promise.resolve(games),
      getAllCurrentTeams: () => Promise.resolve(teams),
    },
    aflService: {
      getGroupTips: async () => groupTips,
    },
  };
}

const meta = preview.meta({
  component: GroupTipsList,
  parameters: { layout: "padded" },
  decorators: [withCurrentRound(1), containerDecorator("max-w-xl"), centeredYDecorator],
});

// Before game starts: tipped vs not-yet-tipped badges
export const UpcomingGameTippedAndNot = meta.story({
  tags: ["demo"],
  parameters: {
    services: buildServices(
      [upcomingGame],
      [
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 101, hasTipped: true }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 101, hasTipped: true }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 101, hasTipped: false }),
        createAflGroupTipEntry({ ...mockUsers.diana, gameId: 101, hasTipped: false }),
        createAflGroupTipEntry({ ...mockUsers.eve, gameId: 101, hasTipped: true }),
      ],
    ),
  },
});

// After game starts (in progress): badges grouped by team
export const StartedGameGroupedByTeam = meta.story({
  parameters: {
    services: buildServices(
      [startedGame],
      [
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 100, tipTeamId: 2 }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.diana, gameId: 100, tipTeamId: 2 }),
        createAflGroupTipEntry({ ...mockUsers.eve, gameId: 100, tipTeamId: 1 }),
      ],
    ),
  },
});

// Completed game: correct group highlighted in green, wrong group faded
export const CompletedGameHomeWins = meta.story({
  parameters: {
    services: buildServices(
      [completedGame],
      [
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 100, tipTeamId: 2 }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.diana, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.eve, gameId: 100, tipTeamId: 2 }),
      ],
    ),
  },
});

// Mix of all three states in one round
export const MixedStates = meta.story({
  parameters: {
    services: buildServices(
      [completedGame, upcomingGame],
      [
        // Completed game — grouped by team, winner highlighted
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 100, tipTeamId: 2 }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 100, tipTeamId: 1 }),
        // Upcoming game — tipped vs not tipped
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 101, hasTipped: true }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 101, hasTipped: false }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 101, hasTipped: true }),
        createAflGroupTipEntry({ ...mockUsers.diana, gameId: 101, hasTipped: false }),
      ],
    ),
  },
});

// All players tipped before game
export const UpcomingAllTipped = meta.story({
  parameters: {
    services: buildServices(
      [upcomingGame],
      [
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 101, hasTipped: true }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 101, hasTipped: true }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 101, hasTipped: true }),
      ],
    ),
  },
});

// No one has tipped before game
export const UpcomingNoneTipped = meta.story({
  parameters: {
    services: buildServices(
      [upcomingGame],
      [
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 101, hasTipped: false }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 101, hasTipped: false }),
      ],
    ),
  },
});

// One team gets all the tips
export const CompletedGameUnanimous = meta.story({
  parameters: {
    services: buildServices(
      [completedGame],
      [
        createAflGroupTipEntry({ ...mockUsers.alice, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.bob, gameId: 100, tipTeamId: 1 }),
        createAflGroupTipEntry({ ...mockUsers.charlie, gameId: 100, tipTeamId: 1 }),
      ],
    ),
  },
});

// Many tippers in a started game
export const ManyTippers = meta.story({
  parameters: {
    services: buildServices(
      [startedGame],
      Array.from({ length: 12 }, (_, i) =>
        createAflGroupTipEntry({
          userId: `user-${i}`,
          displayName: `Player ${i + 1}`,
          avatarUrl: i % 3 === 0 ? "/dummy-footy-logo.png" : null,
          gameId: 100,
          tipTeamId: i % 2 === 0 ? 1 : 2,
        }),
      ),
    ),
  },
});

export const NoGames = meta.story({
  parameters: {
    services: buildServices([], []),
  },
});
