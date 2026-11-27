import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ArchitecturePage } from "~/features/architecture/pages/architecture";
import { architectureSearchSchema } from "~/features/architecture/search";
import { TOPIC_IDS, TOPICS, type TopicId } from "~/features/architecture/topics";

const renderPage = async (url: string) => {
  const rootRoute = createRootRoute();
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: "/architecture",
    validateSearch: architectureSearchSchema,
    component: function Page() {
      return <ArchitecturePage topic={route.useSearch().topic} />;
    },
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    routeTree: rootRoute.addChildren([route]),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
};

describe("architectureSearchSchema", () => {
  it.each(TOPIC_IDS)("keeps the %s Topic", (topic) => {
    expect(architectureSearchSchema.parse({ topic })).toEqual({ topic });
  });

  it("falls back to reading for an unknown Topic", () => {
    expect(architectureSearchSchema.parse({ topic: "nope" })).toEqual({ topic: "reading" });
  });

  it("falls back to reading for a missing Topic", () => {
    expect(architectureSearchSchema.parse({})).toEqual({ topic: "reading" });
  });
});

describe("ArchitecturePage", () => {
  it("marks only the current Topic's chip with aria-current", async () => {
    await renderPage("/architecture?topic=security");

    const chips = within(screen.getByRole("navigation", { name: "Topics" })).getAllByRole("link");
    expect(chips).toHaveLength(TOPICS.length);
    const current = chips.filter((chip) => chip.getAttribute("aria-current") === "true");
    expect(current.map((chip) => chip.textContent)).toEqual(["Who can read what"]);
    expect(current[0]?.getAttribute("href")).toBe("/architecture?topic=security");
  });

  it("opens on the reading Topic when the URL names none", async () => {
    await renderPage("/architecture");

    const chips = within(screen.getByRole("navigation", { name: "Topics" })).getAllByRole("link");
    expect(chips[0]?.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("heading", { level: 2, name: "Opening a page" })).toBeTruthy();
  });

  it("highlights the current Topic's nodes on the map", async () => {
    const { container } = await renderPage("/architecture?topic=sign-in");

    expect(container.querySelectorAll("rect[data-highlighted]")).toHaveLength(2);
  });

  it.each<TopicId>(["tipping", "live-scores"])(
    "shows the %s Topic's title, files on GitHub and decision records",
    async (id) => {
      const topic = TOPICS.find((t) => t.id === id)!;
      await renderPage(`/architecture?topic=${id}`);

      expect(screen.getByRole("heading", { level: 2, name: topic.title })).toBeTruthy();
      for (const file of topic.files) {
        const link = screen.getByRole("link", { name: file });
        expect(link.getAttribute("href")).toBe(
          `https://github.com/Parametricall/hot_shots/blob/main/${file}`,
        );
      }
      const first = String(topic.adr[0]).padStart(4, "0");
      const adrLinks = screen.getAllByRole("link", { name: `ADR ${first}` });
      expect(adrLinks[0]?.getAttribute("href")).toMatch(
        new RegExp(`/blob/main/docs/adr/${first}-.*[.]md$`),
      );
    },
  );

  it("shows the sync cadence table with the squiggle-sync Topic only", async () => {
    const { unmount } = await renderPage("/architecture?topic=squiggle-sync");
    expect(screen.getByRole("columnheader", { name: "Per day" })).toBeTruthy();
    unmount();

    await renderPage("/architecture?topic=reading");
    expect(screen.queryByRole("columnheader", { name: "Per day" })).toBeNull();
  });

  it("lists the stack, the testing and every decision record", async () => {
    await renderPage("/architecture");

    expect(screen.getByRole("heading", { name: "Stack and testing" })).toBeTruthy();
    expect(screen.getByText("React 19")).toBeTruthy();
    const decisions = screen.getByRole("heading", { name: "Decisions" }).parentElement!;
    expect(within(decisions).getAllByRole("link")).toHaveLength(10);
  });
});
