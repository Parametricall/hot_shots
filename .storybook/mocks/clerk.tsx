// Mock Clerk exports for Storybook - prevents Clerk from requiring a real provider

import type { ReactNode } from "react";
import { useClerkMockUser } from "./clerk-mock-user";

export const useUser = () => ({ user: useClerkMockUser() });

export const useAuth = () => {
  const user = useClerkMockUser();
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: user.id,
    sessionId: "session-storybook",
    getToken: async () => null,
    signOut: async () => {},
  };
};

export const useClerk = () => ({
  openSignIn: () => {},
  openSignUp: () => {},
  signOut: async () => {},
});

export const useSession = () => ({ session: null });
export const ClerkProvider = ({ children }: { children: ReactNode }) => children;
export const SignIn = () => null;
export const SignUp = () => null;
export const SignedIn = ({ children }: { children: ReactNode }) => children;
export const UserButton = () => null;
