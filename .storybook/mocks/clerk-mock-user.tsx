import { createContext, useContext } from "react";

export type MockUser = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
};

export const DEFAULT_USER: MockUser = {
  id: "user-storybook",
  fullName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  imageUrl: null,
  primaryEmailAddress: { emailAddress: "jane.doe@example.com" },
};

export const ClerkMockContext = createContext<MockUser>(DEFAULT_USER);

export const useClerkMockUser = () => useContext(ClerkMockContext);
