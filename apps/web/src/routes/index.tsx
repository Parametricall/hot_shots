import { createFileRoute, redirect } from "@tanstack/react-router";
import * as z from "zod";
import { HubPage } from "~/features/hub/pages/hub";
import { getLaunchApp } from "~/features/hub/api/launch-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Hot Shots" }],
    links: [
      { rel: "manifest", href: "/hub.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/hub-icon.png" },
    ],
  }),
  validateSearch: z.object({ launch: z.literal("pwa").optional() }),
  beforeLoad: async ({ search }) => {
    if (search.launch !== "pwa") return;
    const app = await getLaunchApp();
    if (app) throw redirect({ href: app.href });
  },
  loader: async () => {
    const launchApp = await getLaunchApp();
    return { launchAppId: launchApp?.id ?? null };
  },
  component: HubPage,
});
