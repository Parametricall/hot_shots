import { useNavigate, useSearch } from "@tanstack/react-router";
import { SegmentedControl } from "~/features/afl-tipping/components/segmented-control";
import { PlayerStats } from "~/features/afl-tipping/components/player-stats";
import { Standings } from "~/features/afl-tipping/components/standings";
import type { StatsView } from "~/features/afl-tipping/components/stats-view";

const VIEW_OPTIONS = [
  { value: "tipsters", label: "Tipsters" },
  { value: "ladder", label: "AFL Ladder" },
] as const satisfies readonly { value: StatsView; label: string }[];

/**
 * Stats: a segmented control over Tipster stats and the AFL Ladder. The segment and the Round
 * (shared with the tipping pages) are search params, so they survive a reload.
 */
export function StatsPage() {
  const { view = "tipsters", round } = useSearch({
    from: "/_authenticated/afl-tipping/$season/stats",
  });
  const navigate = useNavigate({ from: "/afl-tipping/$season/stats" });

  return (
    <div className="space-y-3" data-app-ready>
      <SegmentedControl
        label="Stats view"
        className="w-full"
        value={view}
        options={VIEW_OPTIONS}
        onChange={(next) =>
          void navigate({ search: (prev) => ({ ...prev, view: next }), replace: true })
        }
      />
      {view === "ladder" ? (
        <Standings />
      ) : (
        <PlayerStats
          round={round}
          onRoundChange={(next) =>
            void navigate({ search: (prev) => ({ ...prev, round: next }), replace: true })
          }
        />
      )}
    </div>
  );
}
