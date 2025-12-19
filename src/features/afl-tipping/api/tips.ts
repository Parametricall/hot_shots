import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";

const SubmitTipSchema = z.object({
  gameId: z.number(),
  teamId: z.number(),
});

export const submitTip = createServerFn()
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId } = data;
    console.log(gameId, " ", teamId);
  });
