import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import { createTestQueryClient } from "~/test/render";
import { clearDemoNow, getDemoNow, setDemoNow } from "~/lib/clock";
import { buildPositions } from "~/features/afl-tipping/demo/demo-positions";
import { visitorStorageKey, visitorStore } from "~/features/afl-tipping/demo/visitor-store";
import { DemoTimeControl } from "./demo-time-control";

const T0 = new Date("2026-05-01T09:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

// Rounds 11, 12 and 13, a week apart, two Games each.
const games = [11, 12, 13].flatMap((round, i) =>
  [0, 1].map((k) => {
    const unixTime = T0 + (i * 7 + k) * DAY;
    return createAflGame({
      id: round * 10 + k,
      round,
      roundName: `Round ${round}`,
      unixTime,
      date: new Date(unixTime),
    });
  }),
);
const positions = buildPositions(games);
// 0: R11 g1, 1: R11 g2, 2: R12 g1, 3: R12 g2, 4: R13 g1, 5: R13 g2, 6: Season over

function renderControl() {
  const queryClient = createTestQueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <DemoTimeControl positions={positions} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  clearDemoNow();
});

describe("DemoTimeControl", () => {
  it("shows the position and says the other Tipsters are made up", () => {
    setDemoNow(positions[2]!.at);
    renderControl();
    expect(screen.getByRole("status")).toHaveTextContent(/Round 12 · before Game 1 of 2/);
    expect(screen.getByText(/the other Tipsters are made up/i)).toBeInTheDocument();
  });

  it("renders nothing until the Demo clock is set", () => {
    renderControl();
    expect(screen.queryByRole("button", { name: "Next game" })).not.toBeInTheDocument();
  });

  it.each([
    ["Next game", 2, 3],
    ["Previous game", 3, 2],
    ["Next round", 2, 4],
    ["Previous round", 3, 2],
    ["Previous round", 2, 0],
  ])("%s moves the clock, saves it and refetches every AFL query", async (name, from, to) => {
    const user = userEvent.setup();
    setDemoNow(positions[from]!.at);
    const { invalidate } = renderControl();

    await user.click(screen.getByRole("button", { name }));

    expect(getDemoNow()).toBe(positions[to]!.at);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: aflQueries.aflKey() });
    const saved = visitorStore.read();
    expect(saved.ok && saved.state.position).toBe(positions[to]!.at);
  });

  it("moves to a Round chosen from the picker", async () => {
    const user = userEvent.setup();
    setDemoNow(positions[0]!.at);
    const { invalidate } = renderControl();

    await user.selectOptions(screen.getByRole("combobox", { name: "Jump to round" }), "Round 13");

    expect(getDemoNow()).toBe(positions[4]!.at);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: aflQueries.aflKey() });
  });

  it("moves to Season over from the picker", async () => {
    const user = userEvent.setup();
    setDemoNow(positions[0]!.at);
    renderControl();

    await user.selectOptions(screen.getByRole("combobox", { name: "Jump to round" }), "over");

    expect(getDemoNow()).toBe(positions[6]!.at);
  });

  it("disables going back at the start and forward at Season over", () => {
    setDemoNow(positions[0]!.at);
    const { unmount } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <DemoTimeControl positions={positions} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Previous game" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous round" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next game" })).toBeEnabled();
    unmount();

    setDemoNow(positions[6]!.at);
    renderControl();
    expect(screen.getByRole("status")).toHaveTextContent("Season over");
    expect(screen.getByRole("button", { name: "Next game" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next round" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous game" })).toBeEnabled();
  });

  describe("Reset demo", () => {
    function saveSomeProgress() {
      window.localStorage.setItem(
        visitorStorageKey(2026),
        JSON.stringify({
          position: positions[4]!.at,
          tips: [
            {
              game_id: 120,
              user_id: "demo-visitor",
              tip: 1,
              margin: null,
              is_underdog: null,
              created_at: "2026-05-01T00:00:00.000Z",
            },
          ],
        }),
      );
      setDemoNow(positions[4]!.at);
    }

    it("asks for confirmation before clearing anything", async () => {
      const user = userEvent.setup();
      saveSomeProgress();
      renderControl();

      await user.click(screen.getByRole("button", { name: "Reset demo" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText("Reset the demo?")).toBeInTheDocument();
      expect(getDemoNow()).toBe(positions[4]!.at);
      expect(window.localStorage.getItem(visitorStorageKey(2026))).not.toBeNull();
    });

    it("keeps everything when cancelled", async () => {
      const user = userEvent.setup();
      saveSomeProgress();
      renderControl();

      await user.click(screen.getByRole("button", { name: "Reset demo" }));
      await user.click(await screen.findByRole("button", { name: "Keep playing" }));

      expect(getDemoNow()).toBe(positions[4]!.at);
      const saved = visitorStore.read();
      expect(saved.ok && saved.state.tips).toHaveLength(1);
    });

    it("clears the Tips, returns to Round 12 and refetches when confirmed", async () => {
      const user = userEvent.setup();
      saveSomeProgress();
      const { invalidate } = renderControl();

      await user.click(screen.getByRole("button", { name: "Reset demo" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Reset demo" }));

      expect(getDemoNow()).toBe(positions[2]!.at);
      const saved = visitorStore.read();
      expect(saved.ok && saved.state.tips).toEqual([]);
      expect(saved.ok && saved.state.position).toBe(positions[2]!.at);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: aflQueries.aflKey() });
    });
  });
});
