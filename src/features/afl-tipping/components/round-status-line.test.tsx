import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RoundStatusLine } from "./round-status-line";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { createTestQueryClient } from "~/test/render";

vi.mock("~/features/afl-tipping/hooks/use-season", () => ({ useSeason: () => 2026 }));
vi.mock("~/app/service-registry", () => ({
  default: { getService: vi.fn().mockReturnValue({}) },
}));

const HOUR = 60 * 60 * 1000;

function renderLine(games: ReturnType<typeof createAflGame>[], tips: { gameId: number }[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(aflQueries.allGames(2026).queryKey, games);
  queryClient.setQueryData(
    aflQueries.getTips(
      2026,
      games.filter((g) => g.round === 3).map((g) => g.id),
    ).queryKey,
    tips.map((tip) => ({ ...tip, tipTeamId: 1 })),
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <CurrentRoundProvider state={3}>
        <RoundStatusLine />
      </CurrentRoundProvider>
    </QueryClientProvider>,
  );
}

const game = (id: number, startsInHours: number, overrides = {}) => {
  const at = Date.now() + startsInHours * HOUR;
  return createAflGame({ id, round: 3, unixTime: at, date: new Date(at), ...overrides });
};

describe("RoundStatusLine", () => {
  it("counts the tipped Games and counts down to the next Game", () => {
    renderLine([game(1, 50), game(2, 80)], [{ gameId: 1 }]);
    expect(
      screen.getByText(/^1\/2 tipped · Next game \w{3} \d{1,2}:\d{2}[ap]m \(2d \d+h\)$/),
    ).toBeInTheDocument();
  });

  it("says the Round is in progress once every Game has started", () => {
    renderLine([game(1, -3), game(2, -1)], [{ gameId: 1 }]);
    expect(screen.getByText("1/2 tipped · Round in progress")).toBeInTheDocument();
  });

  it("says the Round is complete once every Game is", () => {
    renderLine([game(1, -3, { complete: 100 })], [{ gameId: 1 }]);
    expect(screen.getByText("1/1 tipped · Round complete")).toBeInTheDocument();
  });
});
