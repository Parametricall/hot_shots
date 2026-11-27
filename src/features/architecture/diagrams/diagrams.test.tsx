import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import * as z from "zod";
import { describe, expect, it } from "vite-plus/test";
import { DEMO_LABEL } from "~/features/architecture/diagrams/demo-split";
import { LIVE_FLOW_LABEL } from "~/features/architecture/diagrams/live-flow";
import { LIVE_TIMELINE_LABEL } from "~/features/architecture/diagrams/live-timeline";
import { OVERVIEW_LABEL, OverviewMap } from "~/features/architecture/diagrams/overview-map";
import { READING_LABEL } from "~/features/architecture/diagrams/reading-sequence";
import { SCORING_LABEL } from "~/features/architecture/diagrams/scoring-flow";
import { SECURITY_LABEL } from "~/features/architecture/diagrams/security-boundaries";
import { SIGN_IN_LABEL } from "~/features/architecture/diagrams/sign-in-sequence";
import { SYNC_LOOP_LABEL } from "~/features/architecture/diagrams/sync-loop";
import { SyncCadenceTable } from "~/features/architecture/diagrams/sync-cadence-table";
import { TIPPING_LABEL } from "~/features/architecture/diagrams/tipping-flow";
import { TOPIC_DIAGRAMS } from "~/features/architecture/diagrams/topic-diagrams";
import { TOPIC_IDS, type TopicId } from "~/features/architecture/topics";

const LABELS: Record<TopicId, string[]> = {
  reading: [READING_LABEL],
  "sign-in": [SIGN_IN_LABEL],
  tipping: [TIPPING_LABEL],
  scoring: [SCORING_LABEL],
  "squiggle-sync": [SYNC_LOOP_LABEL],
  "live-scores": [LIVE_FLOW_LABEL, LIVE_TIMELINE_LABEL],
  security: [SECURITY_LABEL],
  demo: [DEMO_LABEL],
};

describe("TOPIC_DIAGRAMS", () => {
  it.each(TOPIC_IDS)("renders the %s diagrams with their aria-labels", (topic) => {
    const diagrams = TOPIC_DIAGRAMS[topic];
    expect(diagrams).toHaveLength(LABELS[topic].length);

    diagrams.forEach(({ Diagram, caption }, i) => {
      const { unmount } = render(<Diagram />);
      expect(screen.getByRole("img", { name: LABELS[topic][i] })).toBeTruthy();
      expect(caption.length).toBeGreaterThan(0);
      unmount();
    });
  });

  it("keeps operator-only details out of the captions", () => {
    const captions = TOPIC_IDS.flatMap((t) => TOPIC_DIAGRAMS[t].map((d) => d.caption)).join(" ");
    expect(captions).not.toMatch(/your |\bour\b|Hobby|Opening Round|VITE_LIVE_SCORES/);
  });
});

describe("OverviewMap", () => {
  const renderMap = async (current: TopicId) => {
    const rootRoute = createRootRoute();
    const architectureRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/architecture",
      validateSearch: z.object({ topic: z.enum(TOPIC_IDS).catch("reading") }),
      component: () => <OverviewMap current={current} />,
    });
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/architecture"] }),
      routeTree: rootRoute.addChildren([architectureRoute]),
    });
    await router.load();
    return render(<RouterProvider router={router} />);
  };

  it("links every node to a Topic with a real href", async () => {
    await renderMap("reading");

    expect(screen.getByRole("group", { name: OVERVIEW_LABEL })).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(13);
    const hrefs = new Set(links.map((a) => a.getAttribute("href")));
    expect(hrefs.has("/architecture?topic=live-scores")).toBe(true);
    expect(hrefs.has("/architecture?topic=security")).toBe(true);
    for (const href of hrefs) expect(href).toMatch(/^\/architecture\?topic=/);
  });

  it("outlines only the current Topic's nodes", async () => {
    const { container, unmount } = await renderMap("sign-in");
    const lit = (c: HTMLElement) => c.querySelectorAll("rect[data-highlighted]").length;
    expect(lit(container)).toBe(2);
    unmount();

    const live = await renderMap("live-scores");
    expect(lit(live.container)).toBe(5);
  });
});

describe("SyncCadenceTable", () => {
  it("lists what the sync fetches", () => {
    render(<SyncCadenceTable />);
    expect(screen.getByRole("columnheader", { name: "Per day" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Model tips" })).toBeTruthy();
  });
});
