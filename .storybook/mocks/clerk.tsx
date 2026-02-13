// Mock Clerk exports for Storybook - prevents Clerk from requiring a real provider

import type { ReactNode } from "react";

const DEFAULT_USER = {
  id: "user-storybook",
  fullName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  imageUrl: null,
  primaryEmailAddress: { emailAddress: "jane.doe@example.com" },
};

export const useUser = () => ({
  user: globalThis.__STORYBOOK_CLERK_USER__ ?? DEFAULT_USER,
});
export const useSession = () => ({ session: null });
export const ClerkProvider = ({ children }: { children: ReactNode }) => children;
export const SignIn = () => null;
export const SignUp = () => null;
export const SignedIn = ({ children }: { children: ReactNode }) => children;
export const UserButton = () => null;
