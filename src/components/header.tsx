import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ComponentProps } from "react";
import { signOut } from "~/features/auth/api/session";
import { useCurrentUser } from "~/features/auth/use-current-user";
import { IS_DEMO } from "~/lib/demo";
import { cn } from "~/lib/utils";

const logo = "/dummy-footy-logo.png";

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

export function Header(props: ComponentProps<"header">) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { className, ...headerProps } = props;

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    window.localStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
    await navigate({ to: "/sign-in" });
  };
  return (
    <header
      className={cn("px-2 bg-background/80 backdrop-blur-lg border-b", className)}
      {...headerProps}
    >
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16">
          <Link to="/afl-tipping/tips" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-12 h-12 rounded-xl" />
            </div>
            <span className="hidden sm:block text-xl font-bold text-foreground">Hot Shots</span>
          </Link>

          <span className="sm:block text-xl font-bold text-foreground">AFL Tipping</span>

          {/* User */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">All apps</span>
            </Link>
            {user && (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">Signed in as</span>
                  <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                </div>
                {/* The Demo has no account to sign out of. */}
                {IS_DEMO ? (
                  <Avatar size="lg" className="border-2 border-primary">
                    <AvatarImage src={user.imageUrl ?? undefined} alt={user.displayName} />
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="rounded-full outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      aria-label={`Account menu for ${user.displayName}`}
                    >
                      <Avatar size="lg" className="border-2 border-primary">
                        <AvatarImage src={user.imageUrl ?? undefined} alt={user.displayName} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
