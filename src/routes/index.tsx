import { createFileRoute } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async ({ context: { queryClient } }) => {
    const teams = queryClient.ensureQueryData(aflQueries.teams());
    const standings = queryClient.ensureQueryData(aflQueries.standings());

    const [teamsData, standingsData] = await Promise.all([teams, standings]);
    return { teams: teamsData, standings: standingsData };
  },
});

function Home() {
  const { teams, standings } = Route.useLoaderData();

  return (
    <div className="p-2">
      <h3>Welcome Home!!!</h3>
      <br />
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
    </div>
  );
}
