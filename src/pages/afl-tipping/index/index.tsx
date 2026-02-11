import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Standings } from "~/features/afl-tipping/components/standings";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";
import { MyTips } from "~/pages/afl-tipping/my-tips/my-tips";
import { Header } from "~/components/header";

const TABS = [
  {
    id: "competitions" as const,
    label: "My Tips",
    Component: MyTips,
  },
  {
    id: "standings" as const,
    label: "Standings",
    Component: Standings,
  },
  {
    id: "leaderboard" as const,
    label: "Leaderboard",
    Component: Leaderboard,
  },
];

export function Index() {
  return (
    <div className="px-2">
      <Header />
      <hr />
      <div className="h-full container mx-auto py-2">
        <Tabs defaultValue={TABS[0].id}>
          <TabsList className="w-full">
            {TABS.map((tab) => (
              <TabsTrigger value={tab.id} key={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((tab) => (
            <TabsContent value={tab.id} key={tab.id}>
              {tab.Component ? <tab.Component /> : tab.label}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
