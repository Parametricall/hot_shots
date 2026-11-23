import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { seasonTabPath, type SeasonTab } from "~/features/afl-tipping/components/season-tab-path";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";

/**
 * Picks the Season to look at, newest first, on the tab already open (`round` is dropped: another
 * Season has other Rounds). Hidden until there is more than one Season to pick.
 */
export function SeasonSwitcher({ tab }: { tab: SeasonTab }) {
  const season = useSeason();
  const { data } = useQuery(aflQueries.seasons());

  if (!data || data.seasons.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Season, ${season}. Change season`}>
          {season}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {data.seasons.map((option) => (
            <DropdownMenuItem key={option} asChild>
              <Link to={seasonTabPath(tab)} params={{ season: option }} search={{}}>
                {option}
                {option === data.current.season && (
                  <span className="ml-auto text-xs text-muted-foreground">Current</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
