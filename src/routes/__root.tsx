/// <reference types="vite/client" />
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { Toaster } from "~/components/ui/sonner";

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
  return (
    <ClerkProvider>
      <html>
        <head>
          <HeadContent />
        </head>
        <body suppressHydrationWarning>
          {children}
          <Toaster />
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}
