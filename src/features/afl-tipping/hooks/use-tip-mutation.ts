import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitTip } from "~/features/afl-tipping/api/tips";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { AflUserTip } from "~/features/afl-tipping/types";

interface UseTipMutationOptions {
  gameIds: number[] | undefined;
}

export function useTipMutation({ gameIds }: UseTipMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitTip,
    onMutate: async ({ data: { gameId, teamId } }) => {
      if (!gameIds) return { previousTips: undefined };

      const tipsQuery = aflQueries.getTips(gameIds);

      await queryClient.cancelQueries({
        queryKey: tipsQuery.queryKey,
      });

      const previousTips = queryClient.getQueryData<AflUserTip[]>(tipsQuery.queryKey);

      queryClient.setQueryData<AflUserTip[]>(tipsQuery.queryKey, (old) => {
        if (!old) return old;

        const existingTipIndex = old.findIndex((t) => t.gameId === gameId);
        if (existingTipIndex !== -1) {
          const updatedTips = [...old];
          updatedTips[existingTipIndex] = {
            ...updatedTips[existingTipIndex],
            tipTeamId: teamId,
          };
          return updatedTips;
        } else {
          return [...old, { gameId, tipTeamId: teamId }];
        }
      });

      return { previousTips };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTips && gameIds) {
        queryClient.setQueryData(aflQueries.getTips(gameIds).queryKey, context.previousTips);
      }
    },
    onSettled: () => {
      if (gameIds) {
        queryClient.invalidateQueries(aflQueries.getTips(gameIds));
      }
    },
  });
}
