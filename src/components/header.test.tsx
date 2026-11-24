import { describe, it, expect, vi } from "vite-plus/test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./header";
import { renderInSeasonRouter } from "~/test/render";

const demo = vi.hoisted(() => ({ value: false }));
vi.mock("~/lib/demo", () => ({
  get IS_DEMO() {
    return demo.value;
  },
}));

vi.mock("~/features/auth/api/session", () => ({ signOut: vi.fn() }));
vi.mock("~/features/auth/use-current-user", () => ({
  useCurrentUser: () => ({ id: "u1", displayName: "Jane Doe", imageUrl: null }),
}));

async function openMenu() {
  await renderInSeasonRouter(<Header />);
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: /account menu for jane doe/i }));
}

describe("Header", () => {
  it("has no standalone All apps link", async () => {
    await renderInSeasonRouter(<Header />);
    expect(await screen.findByText("AFL Tipping")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /all apps/i })).not.toBeInTheDocument();
  });

  it("puts All apps and Sign out in the account menu", async () => {
    demo.value = false;
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "All apps" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });

  it("keeps All apps but drops Sign out in the Demo", async () => {
    demo.value = true;
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "All apps" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
