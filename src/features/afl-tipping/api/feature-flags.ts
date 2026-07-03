import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import serviceRegistry from "~/app/service-registry";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

export const getFeatureFlag = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(async ({ data }): Promise<{ enabled: boolean }> => {
    const repo = serviceRegistry.getService("featureFlagsRepository");
    return { enabled: await repo.isEnabled(data.key) };
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string(), enabled: z.boolean() }))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { userId } = await auth();
    if (!userId || userId !== ADMIN_USER_ID) {
      throw new Error("Unauthorized");
    }
    const repo = serviceRegistry.getService("featureFlagsRepository");
    await repo.setEnabled(data.key, data.enabled);
    return { success: true };
  });

export const service = {
  getFeatureFlag,
  setFeatureFlag,
};
