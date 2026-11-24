import { BarChart3, ClipboardCheck, Trophy, Users, type LucideIcon } from "lucide-react";
import type { SeasonTab } from "~/features/afl-tipping/components/season-tab-path";

/**
 * The four sections of a Season, in order. The bottom bar (phones) and the top tab row (desktop)
 * both draw from this list, so they can't drift apart.
 */
export const SEASON_SECTIONS = [
  { id: "tips", label: "Tips", icon: ClipboardCheck },
  { id: "group-tips", label: "Round", icon: Users },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "stats", label: "Stats", icon: BarChart3 },
] as const satisfies readonly { id: SeasonTab; label: string; icon: LucideIcon }[];
