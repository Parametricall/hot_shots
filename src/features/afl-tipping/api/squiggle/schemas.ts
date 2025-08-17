import * as z from "zod";
import {
  AflGame,
  AflStanding,
  AflTeam,
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
  pts: z.number().positive(),
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
    awayTeamId: dto.ateamid,
  }),
);

export const squiggleGamesDtoToDomain = z.object({
  games: z.array(squiggleGameDtoToDomain),
});
