import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  devSignInWithPassword,
  safeRedirectPath,
  sendSignInCode,
  verifySignInCode,
  type SignInResult,
} from "~/features/auth/api/session";

const routeApi = getRouteApi("/sign-in");

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

const REASON_MESSAGES: Record<string, string> = {
  "not-invited":
    "That email address isn't on the invite list. Use the Google account that has the address you were invited with, or get a code sent to that address.",
  "rate-limited": "Too many attempts. Wait a few minutes, then try again.",
  "code-expired": "That code has expired. Send a new one.",
  "code-wrong": "That code isn't right. Check it and try again.",
  failed: "Sign-in didn't work. Try again.",
};

function reasonMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? "Sign-in didn't work. Try again.";
}

export function SignInPage() {
  const queryClient = useQueryClient();
  const { redirect_url: redirectUrl, error: errorReason } = routeApi.useSearch();
  const { supabaseHost } = routeApi.useLoaderData();
  const next = safeRedirectPath(redirectUrl);
  const [reason, setReason] = useState<string | undefined>(errorReason);

  useEffect(() => {
    queryClient.clear();
    window.localStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
  }, [queryClient]);

  const oauthHref = (provider: "google") =>
    `/auth/oauth/${provider}?next=${encodeURIComponent(next)}`;

  return (
    <div
      className="min-h-dvh flex flex-col justify-center items-center w-full gap-6 p-4"
      data-app-ready
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Hot Shots</CardTitle>
          <CardDescription>
            Hot Shots is invite-only. Sign in with the Google account that uses the email address
            you were invited with, or get a code sent to that address.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reason && (
            <p role="alert" className="text-sm text-destructive">
              {reasonMessage(reason)}
            </p>
          )}
          <Button asChild size="lg">
            <a href={oauthHref("google")}>Continue with Google</a>
          </Button>
          {supabaseHost && (
            <p className="-mt-1 text-xs text-muted-foreground">
              Google will say you&apos;re continuing to {supabaseHost}. That&apos;s our sign-in
              service.
            </p>
          )}
          <EmailCodeForm next={next} onFailure={setReason} />
        </CardContent>
      </Card>
      <a href="/privacy" className="text-xs text-muted-foreground underline underline-offset-4">
        Privacy
      </a>
      {import.meta.env.DEV && DEV_USERS.length > 0 && <DevLoginButtons next={next} />}
    </div>
  );
}

function EmailCodeForm({ next, onFailure }: { next: string; onFailure: (reason: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<SignInResult>, onOk: () => void) => {
    setBusy(true);
    try {
      const result = await action();
      if (result.ok) onOk();
      else onFailure(result.reason);
    } catch {
      onFailure("failed");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(
      () => sendSignInCode({ data: { email } }),
      () => setCodeSent(true),
    );

  const verifyCode = () =>
    run(
      () => verifySignInCode({ data: { email, code } }),
      () => {
        window.location.href = next;
      },
    );

  if (!codeSent) {
    return (
      <form
        className="flex flex-col gap-2 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
      >
        <label htmlFor="sign-in-email" className="text-sm font-medium">
          Or get a code by email
        </label>
        <input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          Email me a code
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void verifyCode();
      }}
    >
      <label htmlFor="sign-in-code" className="text-sm font-medium">
        Enter the code we emailed to {email}
      </label>
      <input
        id="sign-in-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm tracking-widest"
      />
      <Button type="submit" disabled={busy}>
        Sign in
      </Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void sendCode()}>
        Send a new code
      </Button>
    </form>
  );
}

function DevLoginButtons({ next }: { next: string }) {
  const [signingInAs, setSigningInAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (user: (typeof DEV_USERS)[number]) => {
    setSigningInAs(user.label);
    setError(null);
    try {
      const result = await devSignInWithPassword({
        data: { email: user.email, password: user.password },
      });
      if (result.ok) {
        window.location.href = next;
        return;
      }
      setError(result.detail ?? result.reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
    setSigningInAs(null);
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
