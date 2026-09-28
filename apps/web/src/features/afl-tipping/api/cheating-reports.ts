import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import serviceRegistry from "~/app/service-registry";

async function ensureUserAuthenticated(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

const ReportSchema = z.object({
  userId: z.string(),
});

export const reportCheating = createServerFn({ method: "POST" })
  .validator(ReportSchema)
  .handler(async ({ data }): Promise<{ success: true }> => {
    const reporterId = await ensureUserAuthenticated();
    if (reporterId === data.userId) {
      throw new Error("You cannot report yourself");
    }
    const repo = serviceRegistry.getService("cheatingReportsRepository");
    await repo.report(data.userId, reporterId);
    return { success: true };
  });

export const checkCheatingReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ reported: boolean; reportCount: number }> => {
    const userId = await ensureUserAuthenticated();
    const repo = serviceRegistry.getService("cheatingReportsRepository");
    const count = await repo.getReportCount(userId);
    return { reported: count > 0, reportCount: count };
  },
);

export const dismissCheatingReport = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ success: true }> => {
    const userId = await ensureUserAuthenticated();
    const repo = serviceRegistry.getService("cheatingReportsRepository");
    await repo.dismissReports(userId);
    return { success: true };
  },
);

export const service = {
  reportCheating,
  checkCheatingReports,
  dismissCheatingReport,
};
