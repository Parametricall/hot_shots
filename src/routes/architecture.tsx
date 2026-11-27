import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { TOPIC_IDS } from "~/features/architecture/topics";

// A stub so the overview map can link to it with a typed search param. The page itself is
// plan 016, Step 6.
export const Route = createFileRoute("/architecture")({
  validateSearch: z.object({ topic: z.enum(TOPIC_IDS).catch("reading") }),
  head: () => ({ meta: [{ title: "How it's built | Hot Shots" }] }),
  component: ArchitecturePage,
});

function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-2xl p-6" data-app-ready>
      <h1 className="text-2xl font-bold">How Hot Shots is built</h1>
    </main>
  );
}
