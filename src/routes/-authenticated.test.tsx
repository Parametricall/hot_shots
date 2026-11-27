import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { currentUserQueryKey } from "~/features/auth/queries";

const { getAuthState } = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<{ userId: string | null }>>(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: () => getAuthState }),
}));

vi.mock("~/features/auth/api/session", () => ({
  getSessionUserId: vi.fn(),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", displayName: "Alex", imageUrl: null })),
}));

const PROFILE = { id: "user-1", displayName: "Alex", imageUrl: null };

type BeforeLoad = (args: {
  location: { href: string };
  context: { queryClient: QueryClient };
  navigate: (options: unknown) => Promise<void>;
  preload: boolean;
}) => Promise<{ userId: string }>;

// The guard remembers when it last asked the server, so each test loads a fresh copy of it.
async function loadGuard() {
  vi.resetModules();
  const { Route } = await import("./_authenticated");
  return Route.options.beforeLoad as unknown as BeforeLoad;
}

function setup({ cachedProfile }: { cachedProfile: boolean }) {
  const queryClient = new QueryClient();
  if (cachedProfile) queryClient.setQueryData(currentUserQueryKey, PROFILE);
  const navigate = vi.fn(async () => {});
  return {
    queryClient,
    navigate,
    args: (preload = false) => ({
      location: { href: "/afl-tipping/2026/tips" },
      context: { queryClient },
      navigate,
      preload,
    }),
  };
}

beforeEach(() => {
  getAuthState.mockReset();
});

describe("the auth guard in the browser", () => {
  it("lets a navigation through at once when the Profile is cached", async () => {
    const beforeLoad = await loadGuard();
    const { args } = setup({ cachedProfile: true });
    // The server never answers: the navigation must not wait for it.
    getAuthState.mockReturnValue(new Promise(() => {}));

    await expect(beforeLoad(args())).resolves.toEqual({ userId: "user-1" });
    expect(getAuthState).toHaveBeenCalledTimes(1);
  });

  it("asks the server at most once a minute", async () => {
    const beforeLoad = await loadGuard();
    const { args } = setup({ cachedProfile: true });
    getAuthState.mockResolvedValue({ userId: "user-1" });

    await beforeLoad(args());
    await beforeLoad(args());
    expect(getAuthState).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask the server for a preload", async () => {
    const beforeLoad = await loadGuard();
    const { args } = setup({ cachedProfile: true });

    await beforeLoad(args(true));
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("sends a Tipster whose session has ended to sign in, and forgets their Profile", async () => {
    const beforeLoad = await loadGuard();
    const { args, navigate, queryClient } = setup({ cachedProfile: true });
    getAuthState.mockResolvedValue({ userId: null });

    await beforeLoad(args());
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/sign-in",
        search: { redirect_url: "/afl-tipping/2026/tips" },
      }),
    );
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();
  });

  it("waits for the server when no Profile is cached, and redirects if signed out", async () => {
    const beforeLoad = await loadGuard();
    const { args } = setup({ cachedProfile: false });
    getAuthState.mockResolvedValue({ userId: null });

    await expect(beforeLoad(args())).rejects.toMatchObject({
      options: { to: "/sign-in", search: { redirect_url: "/afl-tipping/2026/tips" } },
    });
  });

  it("loads the Profile when the server says the session is good", async () => {
    const beforeLoad = await loadGuard();
    const { args, queryClient } = setup({ cachedProfile: false });
    getAuthState.mockResolvedValue({ userId: "user-1" });

    await expect(beforeLoad(args())).resolves.toEqual({ userId: "user-1" });
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(PROFILE);
  });
});
