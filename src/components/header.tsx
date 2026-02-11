import { Link } from "@tanstack/react-router";
import { SignedIn, UserButton, useUser } from "@clerk/tanstack-react-start";
import * as React from "react";
import logo from "/dummy-footy-logo.png?url";

export function Header() {
  const { user } = useUser();
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-12 h-12 rounded-xl" />
            </div>
            <span className="hidden sm:block text-xl font-bold text-foreground">Hot Shots</span>
          </Link>

          <span className="sm:block text-xl font-bold text-foreground">AFL Tipping</span>

          {/* User */}
          <div className="flex items-center gap-3">
            <SignedIn>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-muted-foreground">Signed in as</span>
                <span className="text-sm font-medium text-foreground">
                  {user?.fullName ?? user?.primaryEmailAddress?.emailAddress}
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
