import * as z from "zod";
import {
  AflGame,
  AflStanding,
  AflTeam,
  AflModelTip,
  Venue,
} from "~/features/afl-tipping/types";
import { SQUIGGLE_HOST } from "~/features/afl-tipping/api/squiggle/constants";
import { VENUES } from "~/features/afl-tipping/constants";

const squiggleTeamSchema = z.object({
  id: z.number().positive(), // Team id
  name: z.string(),
  abbrev: z.string(),
  logo: z.string().min(1),
  debut: z.number().positive(),
});

const squiggleTeamDtoToDomain = squiggleTeamSchema.transform<AflTeam>(
  (dto) => ({
    id: dto.id,
    name: dto.name,
    abbrev: dto.abbrev,
    logo: `${SQUIGGLE_HOST}${dto.logo}`,
    debut: dto.debut,
  }),
);

export const squiggleTeamsDtoToDomain = z.object({
  teams: z.array(squiggleTeamDtoToDomain),
});

const squiggleStandingSchema = z.object({
  id: z.number().positive(), // Team id
  name: z.string(),
  rank: z.number().positive(),
  played: z.number().int(),
  wins: z.number().int(),
  draws: z.number().int(),
  losses: z.number().int(),
  pts: z.number(),
  goals_for: z.number().int(),
  goals_against: z.number().int(),
  behinds_for: z.number().int(),
  behinds_against: z.number().int(),
  for: z.number().int(),
  against: z.number().int(),
  percentage: z.number(),
});

const squiggleStandingDtoToDomain =
  squiggleStandingSchema.transform<AflStanding>((dto) => ({
    id: dto.id,
    name: dto.name,
    rank: dto.rank,
  }));

export const squiggleStandingsDtoToDomain = z.object({
  standings: z.array(squiggleStandingDtoToDomain),
});

const squiggleGameSchema = z.object({
  id: z.number(), // Game id
  round: z.number(),
  roundname: z.string(),
  venue: z.string(), // e.g. "M.C.G.
  localtime: z.string(),
  unixtime: z.number(),
  date: z.string(), // could refine with z.string().datetime({ offset: true })
  tz: z.string(),
  year: z.number(),
  is_final: z.number(),
  is_grand_final: z.number(),
  timestr: z.string().nullable(), // e.g. "Full Time"
  updated: z.string(),
  complete: z.number(),
  winner: z.string().nullable(),
  winnerteamid: z.number().nullable(),
  hteamid: z.number().nullable(),
  hteam: z.string().nullable(),
  hscore: z.number(),
  hgoals: z.number().nullable(),
  hbehinds: z.number().nullable(),
  ateamid: z.number().nullable(),
  ateam: z.string().nullable(),
  ascore: z.number(),
  agoals: z.number().nullable(),
  abehinds: z.number().nullable(),
});

const squiggleVenueDomainMap: Record<string, Venue> = {
  "Adelaide Oval": VENUES.adelaideOval,
  "Barossa Park": VENUES.barossaPark,
  "Sydney Showground": VENUES.engieStadium,
  Gabba: VENUES.gabba,
  "Kardinia Park": VENUES.gmhbaStadium,
  "Hands Oval": VENUES.handsOval,
  "Manuka Oval": VENUES.corroboreeGroupOvalManuka,
  "Eureka Stadium": VENUES.marsStadium,
  Docklands: VENUES.marvelStadium,
  "M.C.G.": VENUES.mcg,
  "Bellerive Oval": VENUES.ninjaStadium,
  "Norwood Oval": VENUES.norwoodOval,
  "Perth Stadium": VENUES.optusStadium,
  Carrara: VENUES.peopleFirstStadium,
  "S.C.G.": VENUES.scg,
  "Marrara Oval": VENUES.tioStadium,
  "Traeger Park": VENUES.tioTraegerPark,
  "York Park": VENUES.utasStadium,
};

const squiggleGameDtoToDomain = squiggleGameSchema.transform<AflGame>(
  (dto) => ({
    id: dto.id,
    round: dto.round,
    roundName: dto.roundname,
    venue: squiggleVenueDomainMap[dto.venue] ?? { name: dto.venue },
    unixTime: dto.unixtime * 1000, // Convert from seconds to milliseconds
    date: new Date(dto.unixtime * 1000), // Convert from seconds to milliseconds
    timeStr: dto.timestr ?? "Not Started",
    homeTeamId: dto.hteamid,
    homeScore: dto.hscore,
    awayTeamId: dto.ateamid,
    awayScore: dto.ascore,
    winnerTeamId: dto.winnerteamid,
    complete: dto.complete,
  }),
);

export const squiggleGamesDtoToDomain = z.object({
  games: z.array(squiggleGameDtoToDomain),
});

const squiggleModelTipSchema = z.object({
  ateam: z.string().nullable(),
  ateamid: z.number().nullable(),
  bits: z.string().nullable(),
  confidence: z.string().nullable(),
  correct: z.number().nullable(),
  date: z.string(),
  err: z.string().nullable(),
  gameid: z.number().nullable(),
  hconfidence: z.string().nullable(),
  hmargin: z.string().nullable(),
  hteam: z.string().nullable(),
  hteamid: z.number().nullable(),
  margin: z.string().nullable(),
  round: z.number(),
  source: z.string(),
  sourceid: z.number().nullable(),
  tip: z.string().nullable(),
  tipteamid: z.number().nullable(),
  updated: z.string(),
  venue: z.string().nullable(),
  year: z.number(),
});

const squiggleModelTipDtoToDomain =
  squiggleModelTipSchema.transform<AflModelTip>((dto) => ({
    awayTeamId: dto.ateamid,
    homeTeamId: dto.hteamid,
    confidence: dto.confidence ? parseFloat(dto.confidence) : null,
    gameId: dto.gameid,
    homeConfidence: dto.hconfidence ? parseFloat(dto.hconfidence) : null,
    awayConfidence: dto.hconfidence ? 100 - parseFloat(dto.hconfidence) : null,
    round: dto.round,
    tipTeamId: dto.tipteamid,
  }));

export const squiggleModelTipListDtoToDomain = z.object({
  tips: z.array(squiggleModelTipDtoToDomain),
});
