import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { countUnderdogTips, UnderdogChip, UnderdogWarning } from "./underdog-warning";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { createTestQueryClient } from "~/test/render";

vi.mock("~/features/afl-tipping/hooks/use-season", () => ({ useSeason: () => 2026 }));
vi.mock("~/app/service-registry", () => ({
  default: { getService: vi.fn().mockReturnValue({}) },
}));

describe("UnderdogChip", () => {
  it("is amber with the count below the quota", () => {
    render(<UnderdogChip count={1} hasModelTips isFinals={false} />);
    const chip = screen.getByRole("button", { name: "Underdogs 1/2" });
    expect(chip).toHaveClass("text-amber-800");
  });

  it("turns green once the quota is met", () => {
    render(<UnderdogChip count={2} hasModelTips isFinals={false} />);
    expect(screen.getByRole("button", { name: "Underdogs 2/2" })).toHaveClass("text-green-800");
  });

  it("never reads past the quota", () => {
    render(<UnderdogChip count={4} hasModelTips isFinals={false} />);
    expect(screen.getByRole("button", { name: "Underdogs 2/2" })).toBeInTheDocument();
  });

  it("is hidden in Finals", () => {
    render(<UnderdogChip count={0} hasModelTips isFinals />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is hidden until the Model has tipped the Round's Games", () => {
    render(<UnderdogChip count={0} hasModelTips={false} isFinals={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains the rule when tapped", async () => {
    render(<UnderdogChip count={1} hasModelTips isFinals={false} />);
    const chip = screen.getByRole("button", { name: "Underdogs 1/2" });
    expect(chip).toHaveAttribute("aria-expanded", "false");

    await userEvent.setup().click(chip);

    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/at least 2 times each Round/)).toBeInTheDocument();
    expect(screen.getByText(/Don.t be a shit bloke/)).toBeInTheDocument();
  });
});

describe("countUnderdogTips", () => {
  it("counts Underdog tips on the Round's Games only", () => {
    const tips = [
      { gameId: 1, tipTeamId: 1, isUnderdog: true },
      { gameId: 2, tipTeamId: 1, isUnderdog: false },
      { gameId: 3, tipTeamId: 1, isUnderdog: true },
      { gameId: 4, tipTeamId: 1 },
    ];
    expect(countUnderdogTips(tips, [1, 2, 4])).toBe(1);
    expect(countUnderdogTips(undefined, [1])).toBe(0);
  });
});

describe("UnderdogWarning", () => {
  const games = [createAflGame({ id: 10, round: 3 }), createAflGame({ id: 11, round: 3 })];

  function renderWarning(
    queryClient: QueryClient,
    { tips, modelTips }: { tips: unknown[]; modelTips: unknown[] },
  ) {
    queryClient.setQueryData(aflQueries.allGames(2026).queryKey, games);
    queryClient.setQueryData(aflQueries.getTips(2026, [10, 11]).queryKey, tips as never);
    queryClient.setQueryData(aflQueries.modelTips(2026, 3).queryKey, modelTips as never);
    return render(
      <QueryClientProvider client={queryClient}>
        <CurrentRoundProvider state={3}>
          <UnderdogWarning />
        </CurrentRoundProvider>
      </QueryClientProvider>,
    );
  }

  it("does not nag with no Tips before the Model has tipped", () => {
    renderWarning(createTestQueryClient(), { tips: [], modelTips: [] });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows 0/2 once the Model has tipped and the Tipster has none", () => {
    renderWarning(createTestQueryClient(), {
      tips: [],
      modelTips: [{ gameId: 10, round: 3, tipTeamId: 1 }],
    });
    expect(screen.getByRole("button", { name: "Underdogs 0/2" })).toBeInTheDocument();
  });

  it("counts the Tipster's Underdog tips", () => {
    renderWarning(createTestQueryClient(), {
      tips: [
        { gameId: 10, tipTeamId: 2, isUnderdog: true },
        { gameId: 11, tipTeamId: 1, isUnderdog: false },
      ],
      modelTips: [{ gameId: 10, round: 3, tipTeamId: 1 }],
    });
    expect(screen.getByRole("button", { name: "Underdogs 1/2" })).toBeInTheDocument();
  });
});
