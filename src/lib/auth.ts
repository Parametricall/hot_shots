import { auth } from "@clerk/tanstack-react-start/server";

export async function ensureAuthenticated(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export async function ensureOwner(): Promise<string> {
  const userId = await ensureAuthenticated();
  if (userId !== process.env.ADMIN_USER_ID) {
    throw new Error("Unauthorized");
  }
  return userId;
}
