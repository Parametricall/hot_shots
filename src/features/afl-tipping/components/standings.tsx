import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export function Standings() {
  const { data: standings } = useQuery({
    ...aflQueries.standings(),
  });
  const { data: teams } = useQuery({
    ...aflQueries.teams(),
  });

  if (!standings || !teams) return <div>Loading...</div>;

  return (
    <>
      <h4>Standing:</h4>
      {standings?.map((item) => {
        const team = teams.find((t) => t.id === item.id);
        if (!team) {
          return null; // Skip if team not found
        }
        return (
          <div key={item.id} className="p-2 border-b flex flex-row gap-3">
            {item.rank}
            <h5>{team.name}</h5>
            <img
              src={team.logo}
              alt={`${item.name} logo`}
              className="h-8 w-8"
            />
          </div>
        );
      })}
    </>
  );
}
