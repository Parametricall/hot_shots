import { createFileRoute, redirect } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { useSupabaseClient } from "~/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";

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
  const { user } = useUser();

  const supabaseClient = useSupabaseClient();

  const [tips, setTips] = useState(null);
  const [myTips, setMyTips] = useState(null);

  useEffect(() => {
    async function fetchTips() {
      const { data, error } = await supabaseClient
        .from("afl_tipping")
        .select("*");
      console.log(error);
      return data;
    }
    // @ts-expect-error - wip
    fetchTips().then(setTips);
  }, []);

  useEffect(() => {
    async function fetchTips() {
      const { data, error } = await supabaseClient
        .from("afl_tipping")
        .select("*")
        .eq("user_id", user!.id);

      console.log(error);
      return data;
    }
    // @ts-expect-error - wip
    fetchTips().then(setMyTips);
  }, []);

  return (
    <div className="p-2">
      <h3>Welcome Home!!!</h3>
      <br />
      <h4>All Tips:</h4>
      {JSON.stringify(tips, null, 2)}
      <br />
      <h4>My Tips:</h4>
      {JSON.stringify(myTips, null, 2)}
      <h4>Create a Tip:</h4>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const gameId = formData.get("gameId");
          const teamId = formData.get("teamId");

          const { data, error } = await supabaseClient
            .from("afl_tipping")
            .insert([
              {
                game_id: Number(gameId),
                tip: Number(teamId),
              },
            ]);
          console.log("Insert error:", error);
          console.log("Insert data:", data);
        }}
      >
        <input type="number" name="gameId" placeholder="Game Id" />
        <input type="number" name="teamId" placeholder="Team Id" />
        <button type="submit">Submit Tip</button>
      </form>
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
