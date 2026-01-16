import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitTip } from "./tips";
import { getSupabaseServerClient } from "~/utils/supabase";
import serviceRegistry from "~/service-registry";
import { gameRules } from "./game-rules";

vi.mock("~/utils/supabase");
vi.mock("~/service-registry");
vi.mock("./game-rules");
vi.mock("@clerk/tanstack-react-start/server", () => ({
  auth: vi.fn(),
}));

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  upsert: vi.fn(),
};

const mockSquiggleService = {
  getGames: vi.fn(),
};

describe("submitTip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServerClient as any).mockReturnValue(mockSupabase);
    (serviceRegistry.getService as any).mockReturnValue(mockSquiggleService);
  });

  it("throws if user is not authenticated", async () => {
    const { auth } = await import("@clerk/tanstack-react-start/server");
    (auth as any).mockResolvedValue({ userId: null });
    await expect(submitTip({ data: { gameId: 1, teamId: 2 } })).rejects.toThrow(
      "User not authenticated",
    );
  });

  it("throws if game not found", async () => {
    const { auth } = await import("@clerk/tanstack-react-start/server");
    (auth as any).mockResolvedValue({ userId: "user1" });
    mockSquiggleService.getGames.mockResolvedValue([]);
    await expect(submitTip({ data: { gameId: 1, teamId: 2 } })).rejects.toThrow(
      "Game not found in Squiggle API",
    );
  });

  it("throws if game has no start time", async () => {
    const { auth } = await import("@clerk/tanstack-react-start/server");
    (auth as any).mockResolvedValue({ userId: "user1" });
    mockSquiggleService.getGames.mockResolvedValue([{ id: 1 }]);
    await expect(submitTip({ data: { gameId: 1, teamId: 2 } })).rejects.toThrow(
      "Game not found in Squiggle API",
    );
  });

  it("throws if gameRules.canSubmitTip returns false", async () => {
    const { auth } = await import("@clerk/tanstack-react-start/server");
    (auth as any).mockResolvedValue({ userId: "user1" });
    mockSquiggleService.getGames.mockResolvedValue([
      { id: 1, date: "2025-01-01T10:00:00Z" },
    ]);
    (gameRules.canSubmitTip as any).mockReturnValue(false);
    await expect(submitTip({ data: { gameId: 1, teamId: 2 } })).rejects.toThrow(
      "Cannot submit tip after the game has started",
    );
  });

  it("throws if supabase upsert returns error", async () => {
    const { auth } = await import("@clerk/tanstack-react-start/server");
    (auth as any).mockResolvedValue({ userId: "user1" });
    mockSquiggleService.getGames.mockResolvedValue([
      { id: 1, date: "2025-01-01T10:00:00Z" },
    ]);
    (gameRules.canSubmitTip as any).mockReturnValue(true);
    mockSupabase.upsert.mockResolvedValue({ error: { message: "fail" } });
    await expect(submitTip({ data: { gameId: 1, teamId: 2 } })).rejects.toThrow(
      "fail",
    );
  });

  it("returns success if all is valid", async () => {
    const { auth } = await import("@clerk/tanstack-react-start/server");
    (auth as any).mockResolvedValue({ userId: "user1" });
    mockSquiggleService.getGames.mockResolvedValue([
      { id: 1, date: "2025-01-01T10:00:00Z" },
    ]);
    (gameRules.canSubmitTip as any).mockReturnValue(true);
    mockSupabase.upsert.mockResolvedValue({ error: null });
    await expect(
      submitTip({ data: { gameId: 1, teamId: 2 } }),
    ).resolves.toEqual({ success: true });
  });
});
