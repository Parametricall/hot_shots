import { Link } from "@tanstack/react-router";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
  UserButton,
  useUser,
} from "@clerk/tanstack-react-start";
import { Trophy, User, Home, BarChart3 } from "lucide-react";
import * as React from "react";
import logo from "/dummy-footy-logo.png?url";

export function Header() {
  const auth = useAuth();
  const { user } = useUser();
  return (
    // <div className="p-2 flex gap-2 text-lg">
    //   <Link
    //     to="/"
    //     activeProps={{
    //       className: "font-bold",
    //     }}
    //     activeOptions={{ exact: true }}
    //   >
    //     Home
    //   </Link>
    //   <Link
    //     to="/afl-tipping"
    //     activeProps={{
    //       className: "font-bold",
    //     }}
    //     activeOptions={{ exact: true }}
    //   >
    //     AFL Tipping
    //   </Link>
    //   <SignedIn>
    //     <p>You are signed in</p>
    //     <UserButton />
    //   </SignedIn>
    //   <SignedOut>
    //     <p>You are signed out</p>
    //     <SignInButton />
    //   </SignedOut>
    // </div>
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-6 h-6" />
            </div>
            <span className="hidden sm:block text-xl font-bold text-foreground">
              Hot Shots
            </span>
          </Link>

          <span className="hidden sm:block text-xl font-bold text-foreground">
            AFL Tipping
          </span>

          {/* User */}
          <div className="flex items-center gap-3">
            <SignedIn>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-muted-foreground">
                  Signed in as
                </span>
                <span className="text-sm font-medium text-foreground">
                  {user?.fullName}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-secondary border-2 border-primary overflow-hidden">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-9! h-10!",
                    },
                  }}
                />
              </div>
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
