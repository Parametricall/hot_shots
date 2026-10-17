/**
 * Writes the Demo's snapshot of a past Season (docs/adr/0004).
 *
 * Usage:
 *   npx tsx scripts/snapshot-demo-season.ts --season 2026
 *
 * Fetches Squiggle's teams, Games, Model tips (source 1) and the Ladder after
 * every Round, checks them with the app's own Zod schemas, generates the
 * made-up Tipsters' Tips, and writes
 * src/features/afl-tipping/demo/season-<year>.json. One request per resource,
 * with a short pause between the per-Round Ladder requests. Needs no .env.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  squiggleGamesDtoToDomain,
  squiggleModelTipListDtoToDomain,
  squiggleStandingsDtoToDomain,
  squiggleTeamsDtoToDomain,
} from "~/features/afl-tipping/api/squiggle/schemas";
import {
  SQUIGGLE_API_HOST,
  SQUIGGLE_USER_AGENT,
} from "~/features/afl-tipping/api/squiggle/constants";
import { PERSONAS, seedTips } from "~/features/afl-tipping/demo/seed-tips";
import type { DemoSnapshot } from "~/features/afl-tipping/demo/snapshot";

const PAUSE_BETWEEN_REQUESTS_MS = 400;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readSeason(): number {
  const index = process.argv.indexOf("--season");
  const season = Number(process.argv[index + 1]);
  if (index === -1 || !Number.isInteger(season) || season < 2000) {
    console.error("Usage: npx tsx scripts/snapshot-demo-season.ts --season 2026");
    process.exit(1);
  }
  return season;
}

async function squiggle(query: string): Promise<unknown> {
  const url = `${SQUIGGLE_API_HOST}/?${query}`;
  const res = await fetch(url, { headers: { "User-Agent": SQUIGGLE_USER_AGENT } });
  if (!res.ok) throw new Error(`Squiggle ${res.status} for ${url}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * JSON for the file: objects and arrays are laid out down the page, but a flat
 * object (one Game, one Tip) stays on one line, so the file diffs per row.
 */
function layout(value: unknown, indent = ""): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${inner}${layout(v, inner)}`).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.every(([, v]) => v === null || typeof v !== "object")) return JSON.stringify(value);
  if (entries.length === 0) return "{}";
  const body = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${layout(v, inner)}`);
  return `{\n${body.join(",\n")}\n${indent}}`;
}

async function main() {
  const season = readSeason();

  console.log("Fetching teams, games and Model tips...");
  const teams = await squiggle("q=teams");
  await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  const games = await squiggle(`q=games;year=${season}`);
  await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  const modelTips = await squiggle(`q=tips;year=${season};source=1`);

  // Parsing with the production schemas is the check that Squiggle still sends what the app expects.
  squiggleTeamsDtoToDomain.parse(teams);
  const domainGames = squiggleGamesDtoToDomain.parse(games).games;
  const domainModelTips = squiggleModelTipListDtoToDomain.parse(modelTips).tips;
  if (domainGames.length === 0) throw new Error(`Squiggle has no games for ${season}`);

  const rounds = [...new Set(domainGames.map((g) => g.round))].sort((a, b) => a - b);
  const standingsAfterRound: Record<string, unknown> = {};
  let previousRound: number | undefined;
  for (const round of rounds) {
    console.log(`Fetching the Ladder after round ${round}...`);
    await sleep(PAUSE_BETWEEN_REQUESTS_MS);
    const standings = await squiggle(`q=standings;year=${season};round=${round}`);
    if (squiggleStandingsDtoToDomain.safeParse(standings).success) {
      standingsAfterRound[String(round)] = standings;
      previousRound = round;
      continue;
    }
    // Squiggle stops ranking the Ladder once Finals begin. It does not move
    // after the home-and-away Season, so the last ranked Ladder stands in.
    if (previousRound === undefined) throw new Error(`No usable Ladder for round ${round}`);
    console.warn(`  round ${round} has no ranked Ladder; reusing round ${previousRound}`);
    standingsAfterRound[String(round)] = standingsAfterRound[String(previousRound)];
  }

  const firstGameAt = Math.min(...domainGames.map((g) => g.unixTime));
  const snapshot: DemoSnapshot = {
    season,
    capturedAt: new Date().toISOString(),
    squiggle: { teams, games, modelTips, standingsAfterRound },
    // Every made-up Tipster joined a week before the Season, so none gets a late-joiner gap.
    tipsters: PERSONAS.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      joinedAt: firstGameAt - WEEK_MS,
    })),
    tips: seedTips({ personas: PERSONAS, games: domainGames, modelTips: domainModelTips }),
  };

  const file = resolve(
    import.meta.dirname,
    "..",
    "src/features/afl-tipping/demo",
    `season-${season}.json`,
  );
  writeFileSync(file, `${layout(snapshot)}\n`);
  console.log(
    `Wrote ${file}: ${domainGames.length} games, ${rounds.length} rounds, ${snapshot.tips.length} tips.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
