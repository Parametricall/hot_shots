// AFL team data and fixture structures

export interface Team {
  id: string;
  name: string;
  shortName: string;
  colors: {
    primary: string;
    secondary: string;
  };
}

export interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  time: string;
  venue: string;
}

export interface Round {
  id: string;
  name: string;
  games: Game[];
}

export const AFL_TEAMS: Team[] = [
  {
    id: "adelaide",
    name: "Adelaide Crows",
    shortName: "Adelaide",
    colors: { primary: "#002B5C", secondary: "#FFD100" },
  },
  {
    id: "brisbane",
    name: "Brisbane Lions",
    shortName: "Brisbane",
    colors: { primary: "#A30046", secondary: "#FFD100" },
  },
  {
    id: "carlton",
    name: "Carlton Blues",
    shortName: "Carlton",
    colors: { primary: "#002B5C", secondary: "#FFFFFF" },
  },
  {
    id: "collingwood",
    name: "Collingwood Magpies",
    shortName: "Collingwood",
    colors: { primary: "#000000", secondary: "#FFFFFF" },
  },
  {
    id: "essendon",
    name: "Essendon Bombers",
    shortName: "Essendon",
    colors: { primary: "#CC2031", secondary: "#000000" },
  },
  {
    id: "fremantle",
    name: "Fremantle Dockers",
    shortName: "Fremantle",
    colors: { primary: "#2E0C77", secondary: "#FFFFFF" },
  },
  {
    id: "geelong",
    name: "Geelong Cats",
    shortName: "Geelong",
    colors: { primary: "#001F3F", secondary: "#FFFFFF" },
  },
  {
    id: "goldcoast",
    name: "Gold Coast Suns",
    shortName: "Gold Coast",
    colors: { primary: "#FFD100", secondary: "#CC2031" },
  },
  {
    id: "gws",
    name: "GWS Giants",
    shortName: "GWS",
    colors: { primary: "#FF6600", secondary: "#000000" },
  },
  {
    id: "hawthorn",
    name: "Hawthorn Hawks",
    shortName: "Hawthorn",
    colors: { primary: "#4A2C17", secondary: "#FFD100" },
  },
  {
    id: "melbourne",
    name: "Melbourne Demons",
    shortName: "Melbourne",
    colors: { primary: "#CC2031", secondary: "#002B5C" },
  },
  {
    id: "northmelbourne",
    name: "North Melbourne Kangaroos",
    shortName: "North Melbourne",
    colors: { primary: "#003F7F", secondary: "#FFFFFF" },
  },
  {
    id: "portadelaide",
    name: "Port Adelaide Power",
    shortName: "Port Adelaide",
    colors: { primary: "#00B2A0", secondary: "#000000" },
  },
  {
    id: "richmond",
    name: "Richmond Tigers",
    shortName: "Richmond",
    colors: { primary: "#FFD100", secondary: "#000000" },
  },
  {
    id: "stkilda",
    name: "St Kilda Saints",
    shortName: "St Kilda",
    colors: { primary: "#CC2031", secondary: "#000000" },
  },
  {
    id: "sydney",
    name: "Sydney Swans",
    shortName: "Sydney",
    colors: { primary: "#CC2031", secondary: "#FFFFFF" },
  },
  {
    id: "westcoast",
    name: "West Coast Eagles",
    shortName: "West Coast",
    colors: { primary: "#002B5C", secondary: "#FFD100" },
  },
  {
    id: "westernbulldogs",
    name: "Western Bulldogs",
    shortName: "Western Bulldogs",
    colors: { primary: "#003F7F", secondary: "#CC2031" },
  },
];

// Helper function to get team by id
export const getTeamById = (id: string): Team | undefined => {
  return AFL_TEAMS.find((team) => team.id === id);
};

// Generate round names
export const generateRoundNames = (): string[] => {
  const rounds = ["Opening Round"];
  for (let i = 1; i <= 24; i++) {
    rounds.push(`Round ${i}`);
  }
  rounds.push(
    "Elimination Final",
    "Semi Final",
    "Preliminary Final",
    "Grand Final",
  );
  return rounds;
};

// Sample fixture data for demonstration
export const generateSampleFixtures = (): Round[] => {
  const roundNames = generateRoundNames();
  const rounds: Round[] = [];

  roundNames.forEach((roundName, roundIndex) => {
    const games: Game[] = [];
    const numGames = roundIndex >= 25 ? 2 : 9; // Finals have fewer games

    for (let gameIndex = 0; gameIndex < numGames; gameIndex++) {
      const homeTeamIndex =
        (roundIndex * numGames + gameIndex * 2) % AFL_TEAMS.length;
      const awayTeamIndex = (homeTeamIndex + 1) % AFL_TEAMS.length;

      const gameDate = new Date(
        2024,
        2,
        15 + roundIndex * 7 + Math.floor(gameIndex / 3),
      ); // Spread games across weekend
      const gameTime =
        gameIndex % 3 === 0 ? "13:45" : gameIndex % 3 === 1 ? "16:10" : "19:25";

      games.push({
        id: `${roundIndex}-${gameIndex}`,
        homeTeam: AFL_TEAMS[homeTeamIndex],
        awayTeam: AFL_TEAMS[awayTeamIndex],
        date: gameDate.toISOString().split("T")[0],
        time: gameTime,
        venue: "MCG", // Simplified for demo
      });
    }

    rounds.push({
      id: `round-${roundIndex}`,
      name: roundName,
      games: games.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeA.getTime() - dateTimeB.getTime();
      }),
    });
  });

  return rounds;
};
