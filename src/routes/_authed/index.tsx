import { createFileRoute, Link } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSupabaseClient } from "~/lib/supabaseClient";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/tanstack-react-start";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { createSupabaseServerClient } from "~/lib/server";

const fetchTips = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseClient = await createSupabaseServerClient();
  const { userId } = await auth();
  const { data } = await supabaseClient.from("afl_tipping").select("*");

  const { data: myTips } = await supabaseClient
    .from("afl_tipping")
    .select("*")
    .eq("user_id", userId);
  return {
    data,
    myTips,
  };
});

export const Route = createFileRoute("/_authed/")({
  ssr: false, // disable ssr as there are issues fetching squiggle data server-side
  component: Home,
  loader: async ({ context: { queryClient } }) => {
    const teams = queryClient.ensureQueryData(aflQueries.teams());
    const standings = queryClient.ensureQueryData(aflQueries.standings());

    const [teamsData, standingsData, tips] = await Promise.all([
      teams,
      standings,
      fetchTips(),
    ]);
    return { teams: teamsData, standings: standingsData, tips };
  },
});

function Home() {
  const { userId } = Route.useRouteContext();
  const {
    teams,
    standings,
    tips: { data: loaderTips, myTips: loaderMyTips },
  } = Route.useLoaderData();
  console.log("Loader tips:", loaderTips);
  // const { user } = useUser();

  const supabaseClient = useSupabaseClient();

  const [tips, setTips] = useState(null);
  const [myTips, setMyTips] = useState(null);

  useEffect(() => {
    if (!supabaseClient) return;
    async function fetchTips() {
      const { data, error } = await supabaseClient
        .from("afl_tipping")
        .select("*");
      console.log(error);
      return data;
    }
    fetchTips().then(setTips);
  }, []);

  useEffect(() => {
    if (!supabaseClient) return;
    async function fetchTips() {
      const { data, error } = await supabaseClient
        .from("afl_tipping")
        .select("*")
        .eq("user_id", userId);

      console.log(error);
      return data;
    }
    fetchTips().then(setMyTips);
  }, [userId, supabaseClient]);

  return (
    <div className="p-2">
      <div className="p-2 flex gap-2 text-lg">
        <Link
          to="/"
          activeProps={{
            className: "font-bold",
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
        <Link
          to="/afl-tipping"
          activeProps={{
            className: "font-bold",
          }}
          activeOptions={{ exact: true }}
        >
          AFL Tipping
        </Link>
        <SignedIn>
          <p>You are signed in</p>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <p>You are signed out</p>
          <SignInButton />
        </SignedOut>
      </div>
      <hr />
      <h3>Welcome Home!!!</h3>
      <br />
      <h4>All Tips:</h4>
      {JSON.stringify(tips, null, 2)}
      <h4>All Loader tips:</h4>
      {JSON.stringify(loaderTips, null, 2)}
      <br />
      <h4>My Tips:</h4>
      {JSON.stringify(myTips, null, 2)}
      <h4>My Loader Tips:</h4>
      {JSON.stringify(loaderMyTips, null, 2)}
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
