import { Link } from "@tanstack/react-router";
import { SeasonMoreMenu } from "~/features/afl-tipping/components/season-more-menu";
import { SEASON_SECTIONS } from "~/features/afl-tipping/components/season-tabs";
import type { SeasonTab } from "~/features/afl-tipping/components/season-tab-path";
import { cn } from "~/lib/utils";

type SeasonBottomBarProps = {
  season: number;
  /** The section the URL is on, or `summary` when it is on none. */
  activeTab: SeasonTab;
};

/**
 * The phone's navigation: a bar fixed to the bottom of the screen, where a thumb reaches, with an
 * icon over a label for each of a Season's four sections, then ⋯ More (the Season switcher, and
 * later the App's own settings). It is 3.5rem tall plus the home indicator's inset, which the frame
 * also reads as `--bottom-bar-h`, so page content and the Demo Time control stack above it.
 */
export function SeasonBottomBar({ season, activeTab }: SeasonBottomBarProps) {
  return (
    <nav
      aria-label="AFL Tipping"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex h-14 max-w-xl">
        {SEASON_SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = id === activeTab;
          return (
            <li key={id} className="flex-1">
              <Link
                to={`/afl-tipping/$season/${id}`}
                params={{ season }}
                search={(prev) => ({ round: prev.round })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:bg-accent",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <SeasonMoreMenu season={season} activeTab={activeTab} variant="bar" />
        </li>
      </ul>
    </nav>
  );
}
