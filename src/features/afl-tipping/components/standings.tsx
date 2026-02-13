import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon } from "lucide-react";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { cn } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { AflStanding, AflTeam } from "~/features/afl-tipping/types";

export function Standings() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: standings } = useQuery({
    ...aflQueries.standings(),
  });
  const { data: teams } = useQuery({
    ...aflQueries.teams(),
  });

  if (!standings || !teams) return <div>Loading...</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Team</TableHead>
          <TableHead className="text-center">W</TableHead>
          <TableHead className="text-center">L</TableHead>
          <TableHead className="text-center">D</TableHead>
          <TableHead className="text-center">Pts</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((item) => {
          const team = teams.find((t) => t.id === item.id);
          if (!team) return null;
          const isExpanded = expandedId === item.id;
          return (
            <StandingRow
              key={item.id}
              standing={item}
              team={team}
              isExpanded={isExpanded}
              onToggle={() => setExpandedId(isExpanded ? null : item.id)}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function StandingRow({
  standing,
  team,
  isExpanded,
  onToggle,
}: {
  standing: AflStanding;
  team: AflTeam;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>{standing.rank}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <img src={team.logo} alt={`${team.name} logo`} className="h-6 w-6" />
            {team.name}
          </div>
        </TableCell>
        <TableCell className="text-center">{standing.wins}</TableCell>
        <TableCell className="text-center">{standing.losses}</TableCell>
        <TableCell className="text-center">{standing.draws}</TableCell>
        <TableCell className="text-center font-medium">{standing.points}</TableCell>
        <TableCell>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground size-4 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/50 p-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
              <Stat label="Played" value={standing.played} />
              <Stat label="Percentage" value={`${standing.percentage.toFixed(1)}%`} />
              <Stat label="Goals For" value={standing.goalsFor} />
              <Stat label="Goals Against" value={standing.goalsAgainst} />
              <Stat label="Behinds For" value={standing.behindsFor} />
              <Stat label="Behinds Against" value={standing.behindsAgainst} />
              <Stat label="Points For" value={standing.pointsFor} />
              <Stat label="Points Against" value={standing.pointsAgainst} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
