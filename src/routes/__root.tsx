/// <reference types="vite/client" />
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { AppLoadingScreen } from "~/components/AppLoadingScreen";
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
  pendingComponent: AppLoadingScreen,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  React.useEffect(() => {
    const splash = document.getElementById("app-splash");
    if (splash) {
      splash.remove();
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
          <div
            id="app-splash"
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f9fafb",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            >
              <img
                src="/dummy-footy-logo.png"
                alt=""
                width={80}
                height={80}
                style={{ borderRadius: "0.75rem" }}
              />
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Hot Shots
              </span>
            </div>
          </div>
          <style
            dangerouslySetInnerHTML={{
              __html: `@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`,
            }}
          />
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
