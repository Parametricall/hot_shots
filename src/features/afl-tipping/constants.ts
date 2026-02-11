import { Venue } from "~/features/afl-tipping/types";

// Season structure
export const REGULAR_SEASON_ROUNDS = 25;

// Polling intervals
export const GAME_STATUS_CHECK_INTERVAL_MS = 60000; // 1 minute

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  STANDINGS: 1000 * 60 * 60, // 1 hour
  GAMES: 1000 * 60 * 5, // 5 minutes
  INCOMPLETE_GAMES: 1000 * 60, // 1 minute
  MODEL_TIPS: 1000 * 60 * 60, // 1 hour
  USER_TIPS: 1000 * 60 * 5, // 5 minutes
  LEADERBOARD: 1000 * 60 * 10, // 10 minutes
} as const;

// Fallback values
export const UNKNOWN_TEAM_ABBREV = "UNK";

// venues collected from: https://www.afl.com.au/venues
export const VENUES: Record<string, Venue> = {
  adelaideOval: {
    name: "Adelaide Oval",
    city: "Adelaide",
    state: "SA",
  },
  barossaPark: {
    name: "Barossa Park",
    city: "Barossa Valley", // Technically Lyndoch is the town, but Barossa Valley is more well-known
    state: "SA",
  },
  engieStadium: {
    name: "Engie Stadium",
    city: "Sydney",
    state: "NSW",
  },
  gabba: {
    name: "Gabba",
    city: "Brisbane",
    state: "QLD",
  },
  gmhbaStadium: {
    name: "GMHBA Stadium",
    city: "Geelong",
    state: "VIC",
  },
  handsOval: {
    name: "Hands Oval",
    city: "South Bunbury",
    state: "WA",
  },
  corroboreeGroupOvalManuka: {
    name: "Corroboree Group Oval Manuka",
    city: "Canberra",
    state: "ACT",
  },
  marsStadium: {
    name: "Mars Stadium",
    city: "Ballarat",
    state: "VIC",
  },
  marvelStadium: {
    name: "Marvel Stadium",
    city: "Melbourne",
    state: "VIC",
  },
  mcg: {
    name: "MCG",
    city: "Melbourne",
    state: "VIC",
  },
  ninjaStadium: {
    name: "Ninja Stadium",
    city: "Hobart",
    state: "TAS",
  },
  norwoodOval: {
    name: "Norwood Oval",
    city: "Adelaide",
    state: "SA",
  },
  optusStadium: {
    name: "Optus Stadium",
    city: "Perth",
    state: "WA",
  },
  peopleFirstStadium: {
    name: "People First Stadium",
    city: "Gold Coast",
    state: "QLD",
  },
  scg: {
    name: "SCG",
    city: "Sydney",
    state: "NSW",
  },
  tioStadium: {
    name: "TIO Stadium",
    city: "Darwin",
    state: "NT",
  },
  tioTraegerPark: {
    name: "TIO Traeger Park",
    city: "Alice Springs",
    state: "NT",
  },
  utasStadium: {
    name: "UTAS Stadium",
    city: "Launceston",
    state: "TAS",
  },
};
