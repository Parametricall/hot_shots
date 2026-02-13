import preview, { withMockUser, withRouter } from "#.storybook/preview";
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
      fullName: "Jane Doe",
      imageUrl: null,
    }),
  ],
});

export const WithProfilePicture = meta.story({
  decorators: [
    withMockUser({
      fullName: "Jane Doe",
      imageUrl: "/dummy-footy-logo.png",
    }),
  ],
});

export const EmailOnly = meta.story({
  decorators: [
    withMockUser({
      fullName: null,
      firstName: null,
      lastName: null,
      imageUrl: null,
      primaryEmailAddress: { emailAddress: "jane.doe@example.com" },
    }),
  ],
});
