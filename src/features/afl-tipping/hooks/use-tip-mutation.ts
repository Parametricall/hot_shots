import { useMutation, useQueryClient } from "@tanstack/react-query";
import ServiceRegistry from "~/app/service-registry";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { AflUserTip } from "~/features/afl-tipping/types";
import { toast } from "sonner";

const getAflService = () => ServiceRegistry.getService("aflService");

export function useTipMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["submitTip"],
    mutationFn: (vars: Parameters<ReturnType<typeof getAflService>["submitTip"]>[0]) =>
      getAflService().submitTip(vars),
    onMutate: async ({ data: { gameId, teamId, margin } }) => {
      await queryClient.cancelQueries({
        queryKey: aflQueries.allGetTipsKey(),
      });

      // Snapshot all matching tip queries for rollback
      const previousQueries = queryClient.getQueriesData<AflUserTip[]>({
        queryKey: aflQueries.allGetTipsKey(),
      });

      queryClient.setQueriesData<AflUserTip[]>({ queryKey: aflQueries.allGetTipsKey() }, (old) => {
        if (!old) return old;

        const existingTipIndex = old.findIndex((t) => t.gameId === gameId);
        if (existingTipIndex !== -1) {
          const existingTip = old[existingTipIndex]!;
          const teamChanged = existingTip.tipTeamId !== teamId;
          const updatedTips = [...old];
          updatedTips[existingTipIndex] = {
            ...existingTip,
            tipTeamId: teamId,
            margin,
            // The stored isUnderdog is a snapshot of the model prediction for the
            // *previously* tipped team. When the user consciously switches teams it
            // no longer describes the new tip, so drop it and let the server refetch
            // supply the fresh snapshot. Keeping it would make getTipSnapshotMismatch
            // report a false "no longer matches the prediction" notice on every switch.
            isUnderdog: teamChanged ? undefined : existingTip.isUnderdog,
          };
          return updatedTips;
        } else {
          return [...old, { gameId, tipTeamId: teamId, margin }];
        }
      });

      return { previousQueries };
    },
    onError: (err, variables, context) => {
      console.error("[submitTip] mutation failed", {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        variables,
      });
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error("Failed to submit tip. Please try again.");
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["submitTip"] }) === 1) {
        queryClient.invalidateQueries({
          queryKey: aflQueries.allGetTipsKey(),
        });
        queryClient.invalidateQueries({
          queryKey: aflQueries.allGroupTipsKey(),
        });
        queryClient.invalidateQueries({
          queryKey: aflQueries.allPlayerStatsKey(),
        });
      }
    },
  });
}
