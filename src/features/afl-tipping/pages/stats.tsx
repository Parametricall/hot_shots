import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";
import { PlayerStats } from "~/features/afl-tipping/components/player-stats";

export function StatsPage() {
  return (
    <Tabs defaultValue="leaderboard">
      <TabsList className="w-full mb-4">
        <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        <TabsTrigger value="players">Player Stats</TabsTrigger>
      </TabsList>
      <TabsContent value="leaderboard">
        <Leaderboard />
      </TabsContent>
      <TabsContent value="players">
        <PlayerStats />
      </TabsContent>
    </Tabs>
  );
}
