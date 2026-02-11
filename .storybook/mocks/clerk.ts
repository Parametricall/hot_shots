import type { ReactNode } from "react";

// Mock Clerk exports for Storybook - prevents Clerk from requiring a real provider
export const useUser = () => ({ user: { id: "user-storybook" } });
export const useSession = () => ({ session: null });
export const ClerkProvider = ({ children }: { children: ReactNode }) =>
  children;
export const SignIn = () => null;
export const SignUp = () => null;
export const SignedIn = ({ children }: { children: ReactNode }) => children;
export const UserButton = () => null;
