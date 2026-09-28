/// <reference types="vite/client" />
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { AppLoadingScreen } from "~/components/AppLoadingScreen";
import { seo } from "~/utils/seo";
import { QueryClient } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { Toaster } from "~/components/ui/sonner";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/react-router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

const ReactQueryDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/react-query-devtools").then((res) => ({
          default: res.ReactQueryDevtools,
        })),
      );

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
        title: "Hot Shots",
        description: "Your go-to platform for sports tipping.",
      }),
      {
        name: "theme-color",
        content: "#f9fafb",
      },
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
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/dummy-footy-logo.png",
      },
    ],
  }),
  pendingComponent: () => <AppLoadingScreen />,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  React.useEffect(function onMount() {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return <Outlet />;
}

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
          <React.Suspense>
            <TanStackRouterDevtools position="bottom-left" />
            <ReactQueryDevtools />
          </React.Suspense>
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}
