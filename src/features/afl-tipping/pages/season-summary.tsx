import { SeasonSummary } from "~/features/afl-tipping/components/season-summary/season-summary";

export function SeasonSummaryPage() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto" data-app-ready>
      <SeasonSummary />
    </div>
  );
}
