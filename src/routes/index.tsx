import { createFileRoute } from "@tanstack/react-router";
import {
  fetchAllCurrentTeams,
  fetchStandings,
} from "~/features/afl-tipping/api";
export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const allTeams = await fetchAllCurrentTeams();
    const currentStandings = await fetchStandings();
    return {
      teams: allTeams.teams,
      standings: currentStandings.standings,
    };
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
