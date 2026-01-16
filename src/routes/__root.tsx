/// <reference types="vite/client" />
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/tanstack-react-start";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Hot Shots - AFL",
        description:
          "Your go-to platform for AFL tipping, live scores, and comprehensive statistics.",
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/dummy-footy-logo.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/dummy-footy-logo.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const navigate = Route.useNavigate();
  return (
    <ClerkProvider
      routerPush={(to) => navigate({ to })}
      routerReplace={(to) => navigate({ to, replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <html>
        <head>
          <HeadContent />
        </head>
        <body>
          <div className="p-2 flex gap-2 text-lg">
            <Link
              to="/"
              activeProps={{
                className: "font-bold",
              }}
              activeOptions={{ exact: true }}
            >
              Home
            </Link>
            <Link
              to="/afl-tipping"
              activeProps={{
                className: "font-bold",
              }}
              activeOptions={{ exact: true }}
            >
              AFL Tipping
            </Link>
            <SignedIn>
              <p>You are signed in</p>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <p>You are signed out</p>
              <SignInButton />
            </SignedOut>
          </div>
          <hr />
          {children}
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}
