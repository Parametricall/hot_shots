import { Link } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";
import * as React from "react";

const UserButton = React.lazy(() =>
  import("@clerk/tanstack-react-start").then((m) => ({ default: m.UserButton })),
);
import logo from "/dummy-footy-logo.png?url";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  return fullName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
            {user && (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">Signed in as</span>
                  <span className="text-sm font-medium text-foreground">
                    {user.fullName ?? user.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
                <div className="relative">
                  <Avatar size="lg" className="border-2 border-primary">
                    <AvatarImage
                      src={user.hasImage ? user.imageUrl : undefined}
                      alt={user.fullName ?? "User"}
                    />
                    <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 opacity-0">
                    <React.Suspense fallback={null}>
                      <UserButton
                        appearance={{
                          elements: {
                            userButtonAvatarBox: "w-10! h-10!",
                          },
                        }}
                      />
                    </React.Suspense>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
