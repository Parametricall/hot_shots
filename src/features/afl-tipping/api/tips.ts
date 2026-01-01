import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getSupabaseServerClient } from "~/utils/supabase";
import { auth } from "@clerk/tanstack-react-start/server";

const SubmitTipSchema = z.object({
  gameId: z.number(),
  teamId: z.number(),
});

export const submitTip = createServerFn({ method: "POST" })
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId } = data;
    console.log(gameId, " ", teamId);
    const supabaseClient = getSupabaseServerClient();
    // const { data, error } = await supabaseClient.from("afl_tipping").upsert([
    //   {
    //     game_id: Number(gameId),
    //     tip: Number(teamId),
    //   },
    // ]);
  });

const GetTipsSchema = z.object({
  gameIds: z.array(z.number()),
});

export const getTips = createServerFn({ method: "GET" })
  .inputValidator(GetTipsSchema)
  .handler(async ({ data: { gameIds } }) => {
    console.log("getTips", gameIds);
    const { userId } = await auth();
    const supabaseClient = getSupabaseServerClient();
    // const { data, error } = await supabaseClient
    //   .from("afl_tipping")
    //   .select("*")
    //   .eq("user_id", userId);
  });

export const service = {
  submitTip,
  getTips,
};
