import { createFileRoute } from "@tanstack/react-router";
import { waitUntil } from "@vercel/functions";

// THROWAWAY (plan 015 Step 2b). Never merge: proves a waitUntil task outlives pg_net's 5 s
// timeout and runs to the route's maxDuration. Delete the branch after the test.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const Route = createFileRoute("/api/spike-wait")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer spike") {
          return new Response("no", { status: 401 });
        }
        const id = crypto.randomUUID().slice(0, 8);
        waitUntil(
          (async () => {
            const t0 = Date.now();
            for (let i = 0; i < 9; i++) {
              console.log(`[spike ${id}] alive at ${Math.round((Date.now() - t0) / 1000)}s`);
              await sleep(30_000);
            }
            console.log(`[spike ${id}] finished at ${Math.round((Date.now() - t0) / 1000)}s`);
          })(),
        );
        console.log(`[spike ${id}] returning 202`);
        return new Response(null, { status: 202 });
      },
    },
  },
});
