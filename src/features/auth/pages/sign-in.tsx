import { useEffect, useState } from "react";
import { SignIn, useClerk } from "@clerk/tanstack-react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

const DEV_USERS = import.meta.env.DEV ? getDevUsers() : [];

function getDevUsers() {
  const users: { label: string; email: string; password: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const label = import.meta.env[`VITE_DEV_USER_${i}_LABEL`] as string | undefined;
    const email = import.meta.env[`VITE_DEV_USER_${i}_EMAIL`] as string | undefined;
    const password = import.meta.env[`VITE_DEV_USER_${i}_PASSWORD`] as string | undefined;
    if (label && email && password) users.push({ label, email, password });
  }
  return users;
}

export function SignInPage() {
  const queryClient = useQueryClient();
  const { redirect_url: redirectUrl } = useSearch({ strict: false }) as {
    redirect_url?: string;
  };

  useEffect(() => {
    queryClient.clear();
    window.localStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
  }, [queryClient]);

  return (
    <div className="h-dvh flex flex-col justify-center items-center w-full gap-6" data-app-ready>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl={redirectUrl} />
      {import.meta.env.DEV && DEV_USERS.length > 0 && <DevLoginButtons redirectUrl={redirectUrl} />}
    </div>
  );
}

function DevLoginButtons({ redirectUrl }: { redirectUrl?: string }) {
  const clerk = useClerk();
  const [signingInAs, setSigningInAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!clerk.loaded) return null;

  const handleLogin = async (user: (typeof DEV_USERS)[number]) => {
    setSigningInAs(user.label);
    setError(null);
    try {
      const result = await clerk.client.signIn.create({
        strategy: "password",
        identifier: user.email,
        password: user.password,
      });
      if (result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        window.location.href = redirectUrl ?? "/afl-tipping/tips";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setSigningInAs(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-gray-400 uppercase tracking-wider">Dev Quick Login</p>
      <div className="flex gap-2">
        {DEV_USERS.map((user) => (
          <button
            key={user.label}
            onClick={() => handleLogin(user)}
            disabled={signingInAs !== null}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {signingInAs === user.label ? "Signing in..." : user.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
