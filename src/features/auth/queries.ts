import { queryOptions } from "@tanstack/react-query";
import { getCurrentUser } from "~/features/auth/api/session";

export const currentUserQueryKey = ["auth", "current-user"] as const;

/** The signed-in Profile, or null when signed out. */
export const currentUserQueryOptions = queryOptions({
  queryKey: currentUserQueryKey,
  queryFn: () => getCurrentUser(),
});
