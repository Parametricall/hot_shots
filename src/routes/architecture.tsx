import { createFileRoute } from "@tanstack/react-router";
import { ArchitecturePage } from "~/features/architecture/pages/architecture";
import { architectureSearchSchema } from "~/features/architecture/search";

export const Route = createFileRoute("/architecture")({
  validateSearch: architectureSearchSchema,
  head: () => ({
    meta: [
      { title: "How it's built | Hot Shots" },
      {
        name: "description",
        content:
          "How Hot Shots is built: the browser, the server, the database and Squiggle, and how a page load, a tip, a score and a live update move between them.",
      },
    ],
  }),
  component: ArchitectureRoute,
});

function ArchitectureRoute() {
  const { topic } = Route.useSearch();
  return <ArchitecturePage topic={topic} />;
}
