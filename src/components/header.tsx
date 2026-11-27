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
import { cn, getInitials } from "~/lib/utils";

const logo = "/dummy-footy-logo.png";

/**
 * The App's top bar: 48px tall, so a phone keeps its screen for the page. The logo takes a Tipster
 * to the App's front door; "All apps" (the Hub) is in the avatar's menu, with Sign out, rather
 * than in the bar. The Demo has no account to sign out of, but its menu still has "All apps".
 * `pt-[env(safe-area-inset-top)]` keeps the bar clear of a notch under `viewport-fit=cover`.
 */
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
      className={cn(
        "px-2 bg-background/80 backdrop-blur-lg border-b pt-[env(safe-area-inset-top)]",
        className,
      )}
      {...headerProps}
    >
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-12">
          <Link to="/afl-tipping" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg" />
            </div>
            <span className="hidden sm:block text-xl font-bold text-foreground">Hot Shots</span>
          </Link>

          <span className="text-lg font-bold text-foreground whitespace-nowrap">AFL Tipping</span>

          {/* User */}
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">Signed in as</span>
                  <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="-mr-1 rounded-full p-1 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    aria-label={`Account menu for ${user.displayName}`}
                  >
                    <Avatar className="size-9 border-2 border-primary">
                      <AvatarImage src={user.imageUrl ?? undefined} alt={user.displayName} />
                      <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/">
                        <LayoutGrid aria-hidden />
                        All apps
                      </Link>
                    </DropdownMenuItem>
                    {/* The Demo has no account to sign out of. */}
                    {!IS_DEMO && (
                      <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
