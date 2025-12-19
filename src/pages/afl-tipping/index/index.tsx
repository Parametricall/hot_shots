import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Standings } from "~/features/afl-tipping/components/standings";
import { GamesList } from "~/features/afl-tipping/components/games-list";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";

const TABS = [
  {
    id: "competitions" as const,
    label: "My Tips",
    Component: GamesList,
  },
  {
    id: "standings" as const,
    label: "Standings",
    Component: Standings,
  },
];

export function Index({ view }: { view: (typeof TABS)[number]["id"] }) {
  return (
    <CurrentRoundProvider>
      <div className="h-full container">
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
    </CurrentRoundProvider>
  );
}
