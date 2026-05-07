/**
 * Data migration script: backfill is_underdog for the current round.
 *
 * Usage:
 *   npx tsx scripts/backfill-underdog-current-round.ts [--round N] [--dry-run]
 *
 * Options:
 *   --round N    Override the round to backfill (default: latest round with tips)
 *   --dry-run    Print what would be updated without writing to the database
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_KEY from .env
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env manually (no dotenv dependency)
const envPath = resolve(import.meta.dirname, "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  const value = trimmed.slice(eqIndex + 1);
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const SQUIGGLE_API = "https://api.squiggle.com.au";
const USER_AGENT = "Alex's Tipping App - parametricall@users.noreply.github.com";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const roundArgIndex = args.indexOf("--round");
const roundOverride = roundArgIndex !== -1 ? Number(args[roundArgIndex + 1]) : undefined;

interface SquiggleModelTip {
  gameid: number;
  tipteamid: number;
  round: number;
}

interface TipRow {
  game_id: number;
  user_id: string;
  tip: number;
  is_underdog: boolean | null;
}

async function fetchSquiggleModelTips(round: number): Promise<SquiggleModelTip[]> {
  const year = new Date().getFullYear();
  const url = `${SQUIGGLE_API}/?q=tips;year=${year};round=${round};source=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Squiggle API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.tips ?? []).map((t: Record<string, unknown>) => ({
    gameid: t.gameid as number,
    tipteamid: t.tipteamid as number,
    round: t.round as number,
  }));
}

async function fetchSquiggleGames(): Promise<{ id: number; round: number }[]> {
  const year = new Date().getFullYear();
  const url = `${SQUIGGLE_API}/?q=games;year=${year}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Squiggle API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.games ?? []).map((g: Record<string, unknown>) => ({
    id: g.id as number,
    round: g.round as number,
  }));
}

async function getTipsForRound(gameIds: number[]): Promise<TipRow[]> {
  const { data, error } = await supabase
    .from("afl_tipping")
    .select("game_id, user_id, tip, is_underdog")
    .in("game_id", gameIds);

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  return (data ?? []) as TipRow[];
}

async function main() {
  // Determine the round
  let round: number | undefined;
  if (roundOverride != null) {
    round = roundOverride;
    console.log(`Using specified round: ${round}`);
  } else {
    // Find the latest round that has games
    const allGames = await fetchSquiggleGames();
    const rounds = [...new Set(allGames.map((g) => g.round))].sort((a, b) => b - a);
    // Find latest round with tips
    for (const r of rounds) {
      const rGameIds = allGames.filter((g) => g.round === r).map((g) => g.id);
      const { count } = await supabase
        .from("afl_tipping")
        .select("*", { count: "exact", head: true })
        .in("game_id", rGameIds);
      if (count && count > 0) {
        round = r;
        break;
      }
    }
    if (round == null) {
      console.log("No rounds with tips found.");
      process.exit(0);
    }
    console.log(`Auto-detected latest round with tips: ${round}`);
  }

  // Fetch model tips for the round
  const modelTips = await fetchSquiggleModelTips(round!);
  console.log(`Fetched ${modelTips.length} model tips for round ${round}`);

  // Build model tip lookup: gameId -> tipTeamId
  const modelTipMap = new Map<number, number>();
  for (const mt of modelTips) {
    modelTipMap.set(mt.gameid, mt.tipteamid);
  }

  // Get game IDs for this round
  const games = await fetchSquiggleGames();
  const roundGameIds = games.filter((g) => g.round === round).map((g) => g.id);
  console.log(`Round ${round} has ${roundGameIds.length} games`);

  // Get all user tips for this round
  const tips = await getTipsForRound(roundGameIds);
  console.log(`Found ${tips.length} user tips for round ${round}`);

  // Determine updates
  let updated = 0;
  let skipped = 0;

  for (const tip of tips) {
    const modelTipTeamId = modelTipMap.get(tip.game_id);
    if (modelTipTeamId == null) {
      console.log(`  SKIP game ${tip.game_id} user ${tip.user_id}: no model tip available`);
      skipped++;
      continue;
    }

    const isUnderdog = tip.tip !== modelTipTeamId;

    if (tip.is_underdog === isUnderdog) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  DRY RUN: game ${tip.game_id} user ${tip.user_id}: tip=${tip.tip} model=${modelTipTeamId} -> is_underdog=${isUnderdog}`,
      );
    } else {
      const { error } = await supabase
        .from("afl_tipping")
        .update({ is_underdog: isUnderdog })
        .eq("game_id", tip.game_id)
        .eq("user_id", tip.user_id);

      if (error) {
        console.error(`  ERROR updating game ${tip.game_id} user ${tip.user_id}: ${error.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}${dryRun ? " (dry run)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
