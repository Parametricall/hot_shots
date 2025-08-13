import * as z from "zod";
import { AflStanding, AflTeam } from "~/features/afl-tipping/types";
import { SQUIGGLE_HOST } from "~/features/afl-tipping/api/squiggle/constants";

const squiggleTeamSchema = z.object({
  abbrev: z.string(),
  logo: z.string().min(1),
  name: z.string(),
  id: z.number().positive(),
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
  for: z.number().int(),
  percentage: z.number(),
  behinds_against: z.number().int(),
  played: z.number().int(),
  name: z.string(),
  rank: z.number().positive(),
  goals_against: z.number().int(),
  losses: z.number().int(),
  id: z.number().positive(),
  draws: z.number().int(),
  pts: z.number().positive(),
  against: z.number().int(),
  wins: z.number().int(),
  goals_for: z.number().int(),
  behinds_for: z.number().int(),
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
