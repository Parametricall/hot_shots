import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export function Standings() {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((item) => {
          const team = teams.find((t) => t.id === item.id);
          if (!team) return null;
          return (
            <TableRow key={item.id}>
              <TableCell>{item.rank}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <img
                    src={team.logo}
                    alt={`${team.name} logo`}
                    className="h-6 w-6"
                  />
                  {team.name}
                </div>
              </TableCell>
              <TableCell className="text-center">{item.wins}</TableCell>
              <TableCell className="text-center">{item.losses}</TableCell>
              <TableCell className="text-center">{item.draws}</TableCell>
              <TableCell className="text-center font-medium">
                {item.points}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
