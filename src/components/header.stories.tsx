import preview, { withMockUser, withRouter } from "#.storybook/preview";
import { expect, userEvent, within } from "storybook/test";
import { Header } from "~/components/header";

const meta = preview.meta({
  component: Header,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withRouter],
});

export const WithInitials = meta.story({
  tags: ["demo"],
  decorators: [
    withMockUser({
      displayName: "Jane Doe",
      imageUrl: null,
    }),
  ],
});

export const WithProfilePicture = meta.story({
  decorators: [
    withMockUser({
      displayName: "Jane Doe",
      imageUrl: "/dummy-footy-logo.png",
    }),
  ],
});

export const MenuOpen = meta.story({
  decorators: [withMockUser({ displayName: "Jane Doe" })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /account menu for jane doe/i }),
    );
    const body = within(document.body);
    await expect(await body.findByRole("menuitem", { name: "All apps" })).toBeVisible();
    await expect(await body.findByRole("menuitem", { name: "Sign out" })).toBeVisible();
  },
});
