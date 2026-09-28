import { createFileRoute } from "@tanstack/react-router";
import { HubPage } from "~/features/hub/pages/hub";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Hot Shots" }],
    links: [
      { rel: "manifest", href: "/hub.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/hub-icon.png" },
    ],
  }),
  component: HubPage,
});
