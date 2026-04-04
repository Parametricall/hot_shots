import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { dismissCheatingReport } from "~/features/afl-tipping/api/cheating-reports";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { cn } from "~/lib/utils";

const TOTAL_POINTS = 3;

interface JudyCheatingPopupProps {
  reportCount: number;
}

export function JudyCheatingPopup({ reportCount }: JudyCheatingPopupProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [dismissed, setDismissed] = useState(false);

  const { data: leaderboard } = useQuery(aflQueries.leaderboard());
  const otherPlayers = leaderboard?.filter((e) => e.userId !== user?.id) ?? [];

  const totalAssigned = Object.values(distribution).reduce((a, b) => a + b, 0);
  const remaining = TOTAL_POINTS - totalAssigned;

  const adjust = (userId: string, delta: number) => {
    setDistribution((prev) => {
      const current = prev[userId] ?? 0;
      const next = current + delta;
      if (next < 0) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [userId]: next };
    });
  };

  const dismissMutation = useMutation({
    mutationFn: dismissCheatingReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aflQueries.cheatingReports().queryKey });
      setDismissed(true);
    },
  });

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center">
        <div className="text-5xl sm:text-6xl mb-4">⚖️</div>

        <h2 className="text-xl sm:text-2xl font-bold mb-2">You've been reported for cheating!</h2>

        <p className="text-xs text-gray-400 mb-3">
          {reportCount} report{reportCount !== 1 ? "s" : ""} filed against you.
        </p>

        <p className="text-gray-600 text-sm sm:text-base mb-5">
          To resolve this situation, you must distribute {TOTAL_POINTS} penalty points to other
          players.
        </p>

        <div className="border rounded-lg overflow-hidden mb-4 text-left">
          {otherPlayers.map((player) => {
            const points = distribution[player.userId] ?? 0;
            return (
              <div
                key={player.userId}
                className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {player.avatarUrl ? (
                    <img
                      src={player.avatarUrl}
                      alt={player.displayName}
                      className="h-7 w-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium shrink-0">
                      {player.displayName[0]}
                    </div>
                  )}
                  <span className="text-sm font-medium truncate">{player.displayName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => adjust(player.userId, -1)}
                    disabled={points === 0}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm transition-colors"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold text-sm">{points}</span>
                  <button
                    onClick={() => adjust(player.userId, 1)}
                    disabled={remaining <= 0}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className={cn("text-sm mb-5 font-medium", totalAssigned === TOTAL_POINTS ? "text-green-600" : "text-gray-500")}>
          Points assigned: {totalAssigned} / {TOTAL_POINTS}
        </p>

        <button
          onClick={() => dismissMutation.mutate({ data: undefined })}
          disabled={totalAssigned !== TOTAL_POINTS || dismissMutation.isPending}
          className="w-full rounded-lg px-4 py-3 font-medium text-sm sm:text-base min-h-12 transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {dismissMutation.isPending ? "Submitting..." : "OK"}
        </button>
      </div>
    </div>
  );
}
