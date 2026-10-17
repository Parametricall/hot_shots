import type { AflService } from "~/app/service-registry";
import {
  TIP_REJECTION_MESSAGES,
  buildGroupTips,
  buildLeaderboard,
  buildPlayerStats,
  buildTipsterTips,
  judgeTip,
  type Tipsters,
} from "~/features/afl-tipping/api/competition";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import type { AflUserTip } from "~/features/afl-tipping/types";
import { now as siteNow } from "~/lib/clock";
import { gamesAsOf, tipsAsOf } from "./season-as-of";
import { requireSnapshot } from "./squiggle.service.demo";
import { loadSnapshot, type LoadSnapshotResult } from "./snapshot";
import { DEMO_VISITOR, visitorStore } from "./visitor-store";

/**
 * The Competition as the Demo plays it (docs/adr/0004). The same rules as the
 * server functions (`competition.ts`), run in the browser over the snapshot's
 * made-up Tipsters plus the visitor, whose Tips live in their own browser.
 */

type Deps = {
  loadSnapshot: () => Promise<LoadSnapshotResult>;
  now: () => number;
  store: Pick<typeof visitorStore, "read" | "saveTip">;
};

export function createAflServiceDemo(
  deps: Deps = { loadSnapshot, now: siteNow, store: visitorStore },
): AflService {
  const visitorTips = (): AllTipsRow[] => {
    const saved = deps.store.read();
    return saved.ok ? saved.state.tips : [];
  };

  /** Everything the rules need, as it stands at the Demo clock. */
  async function competition() {
    const snapshot = await requireSnapshot(deps.loadSnapshot);
    const now = deps.now();
    const visitorJoinedAt = snapshot.tipsters[0]?.joinedAt ?? 0;

    const tipsters: Tipsters = new Map([
      ...snapshot.tipsters.map(
        (t) =>
          [
            t.userId,
            { displayName: t.displayName, avatarUrl: null, joinedAt: t.joinedAt },
          ] as const,
      ),
      [
        DEMO_VISITOR.userId,
        {
          displayName: DEMO_VISITOR.displayName,
          avatarUrl: DEMO_VISITOR.avatarUrl,
          joinedAt: visitorJoinedAt,
        },
      ],
    ]);

    return {
      now,
      snapshot,
      visitorJoinedAt,
      tipsters,
      games: gamesAsOf(snapshot.games, now),
      allTips: [...tipsAsOf(snapshot.tips, snapshot.games, now), ...visitorTips()],
    };
  }

  return {
    submitTip: async ({ data: { gameId, teamId, margin } }) => {
      const { now, snapshot, games } = await competition();
      const game = games.find((g) => g.id === gameId);
      const modelTip = snapshot.modelTips.find((t) => t.gameId === gameId);

      const verdict = judgeTip({ game, teamId, modelTip, now });
      if (!verdict.ok) throw new Error(TIP_REJECTION_MESSAGES[verdict.reason]);

      deps.store.saveTip({
        game_id: gameId,
        user_id: DEMO_VISITOR.userId,
        tip: teamId,
        margin: margin ?? null,
        is_underdog: verdict.isUnderdog ?? null,
        created_at: new Date(now).toISOString(),
      });
      return { success: true };
    },

    getTips: async ({ data: { gameIds } }) => {
      const { now, games, visitorJoinedAt } = await competition();
      const storedTips = visitorTips()
        .filter((t) => gameIds.includes(t.game_id))
        .map((t): AflUserTip => ({
          gameId: t.game_id,
          tipTeamId: t.tip,
          margin: t.margin ?? undefined,
          isUnderdog: t.is_underdog ?? undefined,
        }));
      return buildTipsterTips({
        storedTips,
        games,
        gameIds,
        userId: DEMO_VISITOR.userId,
        joinedAt: visitorJoinedAt,
        now,
      });
    },

    getLeaderboard: async () => {
      const { now, games, tipsters, allTips } = await competition();
      return buildLeaderboard({ tips: allTips, games, tipsters, now });
    },

    getGroupTips: async ({ data: { round } }) => {
      const { now, games, tipsters, allTips } = await competition();
      const roundGames = games.filter((g) => g.round === round);
      const gameIds = new Set(roundGames.map((g) => g.id));
      const tips = allTips.filter((t) => gameIds.has(t.game_id));
      return buildGroupTips({ tips, roundGames, tipsters, now });
    },

    getPlayerStats: async () => {
      const { now, games, tipsters, allTips } = await competition();
      return buildPlayerStats({ tips: allTips, games, tipsters, now });
    },
  } satisfies AflService;
}

export const aflServiceDemo = createAflServiceDemo();
