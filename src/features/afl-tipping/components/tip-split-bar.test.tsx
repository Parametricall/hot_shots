import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { splitPercentages, TipSplitBar } from "./tip-split-bar";
import { createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";

const home = createAflTeam({ id: 1, ...fakeTeams.COL });
const away = createAflTeam({ id: 2, ...fakeTeams.ESS });

describe("splitPercentages", () => {
  it("is null with no Tips", () => {
    expect(splitPercentages(0, 0)).toBeNull();
  });

  it("rounds to whole numbers that add to 100", () => {
    expect(splitPercentages(1, 2)).toEqual({ home: 33, away: 67 });
    expect(splitPercentages(5, 0)).toEqual({ home: 100, away: 0 });
  });
});

describe("TipSplitBar", () => {
  it("names both shares and the Model tip for assistive tech", () => {
    render(
      <TipSplitBar
        homeTeam={home}
        awayTeam={away}
        homeCount={6}
        awayCount={4}
        modelTipTeamId={2}
      />,
    );
    expect(
      screen.getByRole("img", { name: "COL 60%, ESS 40%. Model tip: ESS" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Model tip: ESS")).toBeInTheDocument();
  });

  it("omits the Model tip when it names neither team", () => {
    render(
      <TipSplitBar
        homeTeam={home}
        awayTeam={away}
        homeCount={1}
        awayCount={1}
        modelTipTeamId={null}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName("COL 50%, ESS 50%");
    expect(screen.queryByText(/Model tip/)).not.toBeInTheDocument();
  });

  it("renders nothing without Tips", () => {
    render(<TipSplitBar homeTeam={home} awayTeam={away} homeCount={0} awayCount={0} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
