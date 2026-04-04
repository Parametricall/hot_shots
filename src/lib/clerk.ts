import { createClerkClient } from "@clerk/backend";

export async function fetchAllClerkUsers(): Promise<
  Map<string, { displayName: string; avatarUrl: string | null }>
> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const BATCH_SIZE = 100;
  const userMap = new Map<string, { displayName: string; avatarUrl: string | null }>();
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: users } = await clerkClient.users.getUserList({
      limit: BATCH_SIZE,
      offset,
    });
    for (const user of users) {
      userMap.set(user.id, {
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.emailAddresses[0]?.emailAddress ||
          "Unknown User",
        avatarUrl: user.imageUrl ?? null,
      });
    }
    hasMore = users.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  return userMap;
}

export async function fetchAllClerkUsersWithEmail(): Promise<
  Map<string, { displayName: string; avatarUrl: string | null; email: string }>
> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const BATCH_SIZE = 100;
  const userMap = new Map<
    string,
    { displayName: string; avatarUrl: string | null; email: string }
  >();
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: users } = await clerkClient.users.getUserList({
      limit: BATCH_SIZE,
      offset,
    });
    for (const user of users) {
      userMap.set(user.id, {
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.emailAddresses[0]?.emailAddress ||
          "Unknown User",
        avatarUrl: user.imageUrl ?? null,
        email: user.emailAddresses[0]?.emailAddress ?? "",
      });
    }
    hasMore = users.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  return userMap;
}
