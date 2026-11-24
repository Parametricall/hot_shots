import { describe, it, expect, vi } from "vite-plus/test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Standings } from "./standings";
import { createTestQueryClient, renderWithClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { AflStanding, AflTeam } from "~/features/afl-tipping/types";

const mockGetStandings = vi.fn().mockResolvedValue([]);
const mockGetAllCurrentTeams = vi.fn().mockResolvedValue([]);

vi.mock("~/features/afl-tipping/hooks/use-season", () => ({ useSeason: () => 2026 }));

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getStandings: (...args: unknown[]) => mockGetStandings(...args),
      getAllCurrentTeams: (...args: unknown[]) => mockGetAllCurrentTeams(...args),
    }),
  },
}));

function makeTeam(overrides: Partial<AflTeam> = {}): AflTeam {
  return {
    id: 1,
    name: "Richmond Tigers",
    abbrev: "RICH",
    logo: "/logos/richmond.png",
    debut: 1908,
    ...overrides,
  };
}

function makeStanding(overrides: Partial<AflStanding> = {}): AflStanding {
  return {
    id: 1,
    name: "Richmond Tigers",
    rank: 1,
    played: 10,
    wins: 7,
    losses: 3,
    draws: 0,
    points: 28,
    goalsFor: 120,
    goalsAgainst: 90,
    behindsFor: 80,
    behindsAgainst: 70,
    pointsFor: 800,
    pointsAgainst: 610,
    percentage: 131.1,
    ...overrides,
  };
}

describe("Standings", () => {
  it("shows skeleton when standings data is missing", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allTeamsKey(), [makeTeam()]);
    renderWithClient(<Standings />, queryClient);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows skeleton when teams data is missing", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [makeStanding()]);
    renderWithClient(<Standings />, queryClient);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state with retry button when query fails", async () => {
    mockGetStandings.mockRejectedValueOnce(new Error("Network error"));
    renderWithClient(<Standings />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load standings/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders a row for each team with rank, name, W/L/D and Pts", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [
      makeStanding({ id: 1, rank: 1, wins: 7, losses: 3, draws: 0, points: 28 }),
    ]);
    queryClient.setQueryData(aflQueries.allTeamsKey(), [
      makeTeam({ id: 1, name: "Richmond Tigers" }),
    ]);
    renderWithClient(<Standings />, queryClient);

    expect(screen.getByText("Richmond Tigers")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // rank
    expect(screen.getByText("7")).toBeInTheDocument(); // wins
    expect(screen.getByText("3")).toBeInTheDocument(); // losses
    expect(screen.getByText("28")).toBeInTheDocument(); // points
  });

  it("does not render a row when the team is not found in the teams list", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [
      makeStanding({ id: 99, name: "Unknown Team" }),
    ]);
    queryClient.setQueryData(aflQueries.allTeamsKey(), [makeTeam({ id: 1 })]);
    renderWithClient(<Standings />, queryClient);

    expect(screen.queryByText("Unknown Team")).not.toBeInTheDocument();
  });

  it("expands a row to show detailed stats when clicked", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [
      makeStanding({ id: 1, played: 10, percentage: 131.1, goalsFor: 120 }),
    ]);
    queryClient.setQueryData(aflQueries.allTeamsKey(), [makeTeam({ id: 1 })]);
    renderWithClient(<Standings />, queryClient);

    expect(screen.queryByText("Played")).not.toBeInTheDocument();

    await user.click(screen.getByText("Richmond Tigers"));

    expect(screen.getByText("Played")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("131.1%")).toBeInTheDocument();
    expect(screen.getByText("Goals For")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("collapses an expanded row when clicked again", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [makeStanding({ id: 1 })]);
    queryClient.setQueryData(aflQueries.allTeamsKey(), [makeTeam({ id: 1 })]);
    renderWithClient(<Standings />, queryClient);

    await user.click(screen.getByText("Richmond Tigers"));
    expect(screen.getByText("Played")).toBeInTheDocument();

    await user.click(screen.getByText("Richmond Tigers"));
    expect(screen.queryByText("Played")).not.toBeInTheDocument();
  });

  it("shows the team's abbreviation for a phone beside its full name for wider screens", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [makeStanding({ id: 1 })]);
    queryClient.setQueryData(aflQueries.allTeamsKey(), [makeTeam({ id: 1 })]);
    renderWithClient(<Standings />, queryClient);

    expect(screen.getByText("RICH")).toHaveClass("sm:hidden");
    expect(screen.getByText("Richmond Tigers")).toHaveClass("hidden", "sm:inline");
  });

  it("has a percentage column", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allStandingsKey(2026), [
      makeStanding({ id: 1, percentage: 131.14 }),
    ]);
    queryClient.setQueryData(aflQueries.allTeamsKey(), [makeTeam({ id: 1 })]);
    renderWithClient(<Standings />, queryClient);

    expect(screen.getByRole("columnheader", { name: "%" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "131.1" })).toBeInTheDocument();
  });

  it("draws the finals cut-off line under tenth place in 2026", () => {
    const queryClient = createTestQueryClient();
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    queryClient.setQueryData(
      aflQueries.allStandingsKey(2026),
      ids.map((id) => makeStanding({ id, rank: id })),
    );
    queryClient.setQueryData(
      aflQueries.allTeamsKey(),
      ids.map((id) => makeTeam({ id, name: `Team ${id}`, abbrev: `T${id}` })),
    );
    renderWithClient(<Standings />, queryClient);

    const dashed = screen
      .getAllByRole("row")
      .filter((row) => row.className.includes("border-dashed"));
    expect(dashed).toHaveLength(1);
    expect(dashed[0]).toHaveTextContent("Team 10");
    expect(screen.getByText(/the top 10 play finals/)).toBeInTheDocument();
  });
});
