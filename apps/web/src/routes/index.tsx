import { createFileRoute } from "@tanstack/react-router";
import { HubPage } from "~/features/hub/pages/hub";

export const Route = createFileRoute("/")({
  component: HubPage,
});
