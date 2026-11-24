import { Link } from "@tanstack/react-router";
import { BookOpen, Ellipsis } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { SeasonSwitcher } from "~/features/afl-tipping/components/season-switcher";
import type { SeasonTab } from "~/features/afl-tipping/components/season-tab-path";
import { cn } from "~/lib/utils";

type SeasonMoreMenuProps = {
  /** The Season open, which How tipping works stays in. */
  season: number;
  /** The tab open, which a Season pick stays on. */
  activeTab: SeasonTab;
  /** `bar`: the last item of the phone's bottom bar, opening a sheet from the bottom. `button`: a
   * button beside the desktop tab row, opening a panel from the right. */
  variant: "bar" | "button";
};

/**
 * "More": the AFL Tipping App's own extras, behind ⋯ at the end of its sections. Today that is the
 * Season switcher and How tipping works. Settings or admin for AFL Tipping alone belong here too;
 * things that span the site (All apps, Sign out, site admin such as Invitations) belong in the
 * header's avatar menu.
 */
export function SeasonMoreMenu({ season, activeTab, variant }: SeasonMoreMenuProps) {
  const isBar = variant === "bar";

  return (
    <Sheet>
      <SheetTrigger asChild>
        {isBar ? (
          <button
            type="button"
            className="flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground outline-none focus-visible:bg-accent data-[state=open]:text-primary"
          >
            <Ellipsis className="size-5" aria-hidden />
            More
          </button>
        ) : (
          <Button variant="ghost" size="sm" className="shrink-0">
            <Ellipsis aria-hidden />
            More
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side={isBar ? "bottom" : "right"}
        className={cn(
          "gap-2",
          isBar && "max-h-[80dvh] rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+1rem)]",
        )}
      >
        <SheetHeader className="pb-0">
          <SheetTitle>AFL Tipping</SheetTitle>
          <SheetDescription className="sr-only">
            Pick a Season to view, or read how tipping works.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto">
          <SeasonSwitcher tab={activeTab} />
          <div className="mt-2 border-t pt-2">
            <SheetClose asChild>
              <Link
                to="/afl-tipping/$season/how-tipping-works"
                params={{ season }}
                aria-current={activeTab === "how-tipping-works" ? "page" : undefined}
                className="flex min-h-12 items-center gap-3 px-4 text-base outline-none hover:bg-accent focus-visible:bg-accent aria-[current=page]:font-semibold"
              >
                <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                How tipping works
              </Link>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
