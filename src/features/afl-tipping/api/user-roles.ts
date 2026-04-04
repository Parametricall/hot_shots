import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { ensureOwner } from "~/lib/auth";
import { fetchAllClerkUsersWithEmail } from "~/lib/clerk";
import serviceRegistry from "~/app/service-registry";

export type UserWithRoles = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  roles: string[];
};

export const listAllUsersWithRoles = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserWithRoles[]> => {
    await ensureOwner();

    const [clerkUsers, userRoles] = await Promise.all([
      fetchAllClerkUsersWithEmail(),
      serviceRegistry.getService("userRolesRepository").getAllUserRoles(),
    ]);

    const rolesByUserId = new Map(userRoles.map((r) => [r.userId, r.roles]));

    return Array.from(clerkUsers.entries()).map(([userId, info]) => ({
      userId,
      displayName: info.displayName,
      avatarUrl: info.avatarUrl,
      email: info.email,
      roles: rolesByUserId.get(userId) ?? [],
    }));
  },
);

const RoleActionSchema = z.object({
  userId: z.string(),
  role: z.string(),
});

export const grantRole = createServerFn({ method: "POST" })
  .inputValidator(RoleActionSchema)
  .handler(async ({ data }) => {
    await ensureOwner();
    await serviceRegistry.getService("userRolesRepository").grantRole(data.userId, data.role);
    return { success: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .inputValidator(RoleActionSchema)
  .handler(async ({ data }) => {
    await ensureOwner();
    await serviceRegistry.getService("userRolesRepository").revokeRole(data.userId, data.role);
    return { success: true };
  });
