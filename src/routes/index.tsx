import { createFileRoute, redirect } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { useSupabaseClient } from "~/lib/supabaseClient";
import { useEffect, useState } from "react";

const authStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated) {
    // This will error because you're redirecting to a path that doesn't exist yet
    // You can create a sign-in route to handle this
    // See https://clerk.com/docs/tanstack-react-start/guides/development/custom-sign-in-or-up-page
    throw redirect({
      to: "/sign-in",
    });
  }

  return { userId };
});

export const Route = createFileRoute("/")({
  component: Home,
  beforeLoad: async () => await authStateFn(),
  loader: async ({ context: { queryClient, userId } }) => {
    const teams = queryClient.ensureQueryData(aflQueries.teams());
    const standings = queryClient.ensureQueryData(aflQueries.standings());

    const [teamsData, standingsData] = await Promise.all([teams, standings]);
    return { teams: teamsData, standings: standingsData, userId };
  },
});

function Home() {
  const { teams, standings } = Route.useLoaderData();

  const supabaseClient = useSupabaseClient();

  const [tips, setTips] = useState(null);

  useEffect(() => {
    async function fetchTips() {
      const { data, error } = await supabaseClient
        .from("afl_tipping")
        .select("*");
      console.log(error);
      return data;
    }
    fetchTips().then(setTips);
  }, []);

  return (
    <div className="p-2">
      <h3>Welcome Home!!!</h3>
      <br />
      <h4>Your Tips:</h4>
      {JSON.stringify(tips, null, 2)}
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
