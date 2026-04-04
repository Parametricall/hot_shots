import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import serviceRegistry from "~/app/service-registry";
import { ensureUserHasRole } from "./user-roles.repository";

export const getFeatureFlag = createServerFn({ method: "GET" })
  .inputValidator(z.object({ key: z.string() }))
  .handler(async ({ data }) => {
    const repo = serviceRegistry.getService("featureFlagsRepository");
    return { enabled: await repo.isEnabled(data.key) };
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .inputValidator(z.object({ key: z.string(), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await ensureUserHasRole("admin");
    const repo = serviceRegistry.getService("featureFlagsRepository");
    await repo.setEnabled(data.key, data.enabled);
    return { success: true };
  });

export const listAllFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  await ensureUserHasRole("admin");
  const repo = serviceRegistry.getService("featureFlagsRepository");
  return repo.listAll();
});
