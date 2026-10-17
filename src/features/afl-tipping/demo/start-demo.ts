import serviceRegistry from "~/app/service-registry";
import { setDemoNow } from "~/lib/clock";
import { aflServiceDemo } from "./afl.service.demo";
import { liveScoresServiceDemo } from "./live-scores.service.demo";
import { buildPositions, positionIndexAt, startingPosition } from "./demo-positions";
import { loadSnapshot } from "./snapshot";
import { squiggleServiceDemo } from "./squiggle.service.demo";
import { visitorStore } from "./visitor-store";

/**
 * Switches the site into the Demo (docs/adr/0004): registers the Demo services
 * in place of the real ones and puts the Demo clock where the visitor left it,
 * or just before the first Game of the start Round on a first visit.
 *
 * Called from `getRouter` before the router is created. The Hub also renders on
 * the server, but AFL Tipping never does in the Demo, so the clock and the
 * snapshot are only touched in the browser.
 */
export async function startDemo(): Promise<void> {
  serviceRegistry.registerService("squiggleService", squiggleServiceDemo);
  serviceRegistry.registerService("aflService", aflServiceDemo);
  serviceRegistry.registerService("liveScoresService", liveScoresServiceDemo);

  if (typeof window === "undefined") return;

  const loaded = await loadSnapshot();
  if (!loaded.ok) {
    // The services throw the same error when a page asks for data, and the
    // route's error boundary shows it.
    console.error("[demo] snapshot failed to load", loaded.reason, loaded.detail);
    return;
  }

  const positions = buildPositions(loaded.snapshot.games);
  const saved = visitorStore.read();
  const savedAt = saved.ok ? saved.state.position : undefined;
  const at = savedAt !== undefined ? positions[positionIndexAt(positions, savedAt)]!.at : undefined;
  setDemoNow(at ?? startingPosition(positions).at);
}
