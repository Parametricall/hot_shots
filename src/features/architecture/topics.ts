/**
 * The copy and file references for the Architecture page's eight Topics, and the ADR list.
 *
 * Every path in `files` and every number in `adr` is checked against the repo by `topics.test.ts`,
 * so the page can't name a file or decision that no longer exists. An ADR or change that alters
 * how parts connect updates this module in the same change.
 *
 * `adr` is always an array with at least one number, so the page renders it one way. The first
 * number is the decision the Topic's `why` argues for.
 */

export const TOPIC_IDS = [
  "reading",
  "sign-in",
  "tipping",
  "scoring",
  "squiggle-sync",
  "live-scores",
  "security",
  "demo",
] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

export type Topic = {
  id: TopicId;
  title: string;
  intro: string;
  /** Numbered items ("How it works", "One run, step by step"). Plain text. */
  steps?: readonly string[];
  /** Bulleted rules the Topic enforces. Plain text. */
  rules?: readonly string[];
  /** Repo-relative paths, shown under "Where it lives". */
  files: readonly string[];
  /** ADR numbers the "Why" line cites. */
  adr: readonly number[];
  why: string;
};

export type Adr = { number: number; title: string };

export const TOPICS: readonly Topic[] = [
  {
    id: "reading",
    title: "Opening a page",
    intro:
      "Pages draw from a cache in the browser first, then refresh it from the server. The server reads our own tables, never Squiggle.",
    steps: [
      'Each page asks for data with a TanStack Query key that starts with the Season, like ["afl", "season", 2027, "games"]. Switching Seasons switches every query at once.',
      "Queries don't call the server directly. They ask the service registry for a service, such as squiggleService.getGames. The live site registers services that call server functions. The Demo registers its own.",
      "A server function runs on Vercel. It checks the session cookie, then reads through squiggleDataRepository or a tips repository using the server-only secret key.",
      "The whole query cache is saved to localStorage for 24 hours, and cleared by each deploy. An installed app opens straight onto its last screen.",
      "Games count as stale after one minute. Live updates keep them current while the app is open. Reopening or refocusing the app refetches them from the database.",
    ],
    files: [
      "src/features/afl-tipping/api/queries.ts",
      "src/app/service-registry.ts",
      "src/app/router.tsx",
      "src/features/afl-tipping/api/squiggle.serverfns.ts",
      "src/features/afl-tipping/api/squiggle-data.repository.ts",
    ],
    adr: [4],
    why: "Why the registry: the pages don't know whether data comes from the server or the Demo's snapshot, so the same code runs both.",
  },
  {
    id: "sign-in",
    title: "Signing in",
    intro:
      "Supabase Auth with Google or an emailed one-time code, and no passwords. Every step runs on the server, which sets the session cookie itself. JavaScript in the page can't read that cookie.",
    steps: [
      "Invite-only. A hook refuses any email address with no Invitation, before Supabase creates an account.",
      "Cookies only the server touches. The server sets the session as HttpOnly cookies in its responses. Safari caps cookies written by JavaScript at 7 days, but not these, so nobody has to sign in every week.",
      "The guard. Every route under _authenticated calls getSessionUserId() first, and sends anyone without a session to /sign-in. getClaims() also refreshes a session that's about to expire.",
      "Profile, Tipster, entry. A new account gets a Profile (name and photo). Opening AFL Tipping for the first time makes them a Tipster. Opening it during a Season enters them in that Season's Competition, and Auto-tips start from that moment.",
    ],
    files: [
      "src/routes/auth/oauth.$provider.ts",
      "src/routes/auth/callback.ts",
      "src/routes/_authenticated.tsx",
      "src/features/auth/api/session.ts",
      "src/lib/supabase.ts",
    ],
    adr: [6, 7],
    why: "Why: Clerk's free plan ended sessions every 7 days. Supabase Auth with server-set cookies has no session limit, and the site already runs on Supabase. Entering a Competition by opening the App is its own decision.",
  },
  {
    id: "tipping",
    title: "Submitting a Tip",
    intro:
      "One server function decides whether a Tip may be saved and whether it's an Underdog tip, using the site's copy of the Game and the Model tip as they stand at that moment.",
    rules: [
      "Lockout is the moment the Game starts. Until then a Tip can be changed and nobody else can see it. Group tips hides other people's teams until the start.",
      "An Underdog tip is judged against the Model tip as it stood when the Tip was made. It stays an Underdog tip even if the Model changes its mind later.",
      "The Margin is only kept for the Margin game, the first Game of the Round by start time.",
      "Saving the same Game again replaces the earlier Tip, keyed on Game and Tipster.",
    ],
    files: [
      "src/features/afl-tipping/api/tips.ts",
      "src/features/afl-tipping/api/competition.ts",
      "src/features/afl-tipping/api/game-rules.ts",
      "src/features/afl-tipping/hooks/use-tip-mutation.ts",
    ],
    adr: [9],
    why: "Why one Game: submitTip used to fetch the whole Season from Squiggle to check one Game. It now reads one row of the site's own copy.",
  },
  {
    id: "scoring",
    title: "Auto-tips & the Leaderboard",
    intro:
      "The Leaderboard is worked out fresh on each request from four inputs. Missed Games are filled with Auto-tips first, so everyone is scored on the same set of Games.",
    rules: [
      "Auto-tip: a Tipster who hadn't tipped a Game by Lockout gets the Home team. It only applies to Games whose Lockout came after they entered the Competition, and it's never an Underdog tip.",
      "Score is the number of Correct tips. In a Draw, every Tip on that Game is wrong.",
      "Margin difference is how far a Margin was from the result. Tipping the wrong team adds the real margin to the tipped one. The lowest season total breaks ties.",
      "Tipsters still level share the rank. A finished Season's last place is the Wooden spoon, unless the Competition has three or fewer.",
      "The Underdog quota is two per Round outside Finals. Missing it is called out but doesn't cost points.",
    ],
    files: [
      "src/features/afl-tipping/api/competition.ts",
      "src/features/afl-tipping/api/auto-tips.ts",
      "src/features/afl-tipping/api/player-stats.ts",
    ],
    adr: [1],
    why: "Why it's computed, not stored: Auto-tips and scores depend on Game results that change during a Round. Working them out per request from Tips and Games means there's nothing to get out of step.",
  },
  {
    id: "squiggle-sync",
    title: "The Squiggle sync",
    intro:
      "A schedule, not visitors, decides when Squiggle is asked for data. Every 10 minutes Supabase calls the sync endpoint, and a planner works out whether anything is due.",
    rules: [
      "At most 10 requests a run and 300 a day. Past that, the planner plans nothing.",
      "After a failure, that job waits 1, 2, 4 ... up to 60 minutes.",
      "A response that doesn't match its Zod schema writes nothing, so the last good data stays.",
      "Live data rule: for a Game the live ingest updated in the last 10 minutes, the sync doesn't overwrite its scores. Squiggle's Standard API runs up to 60 seconds behind its Event API.",
      "Every request carries a User-Agent with a contact email, so Squiggle can reach the site's owner.",
    ],
    files: [
      "src/features/afl-tipping/sync/plan-squiggle-sync.ts",
      "src/features/afl-tipping/sync/run-squiggle-sync.ts",
      "src/features/afl-tipping/api/squiggle/api.ts",
      "docs/squiggle-sync.md",
    ],
    adr: [9],
    why: "Why: Squiggle's terms say it isn't a backend for user-facing sites. The site's traffic to it now depends on the calendar, not on how many Tipsters there are.",
  },
  {
    id: "live-scores",
    title: "Live scores",
    intro:
      "One connection to Squiggle for the whole site, held in runs of about five minutes. A database trigger fans every change out to signed-in tabs over Supabase Realtime.",
    steps: [
      "Takes the lease, a single database row that only one run can hold. If another run has it, this one stops straight away.",
      "Checks afl_games for a Game that's live or starts within 30 minutes. If there's none, it stops.",
      "Opens sse.squiggle.com.au/events, which covers every Game, with the site's User-Agent.",
      "Writes each event's live fields to afl_games. A Game that finishes without a winner gets one from the scores, and a Draw gets none.",
      "If the connection drops, it reconnects after 2, 4, 8, 16, then 30 seconds. A refusal such as a 403 stops the run.",
      "At about 290 seconds it closes, releases the lease, and records a live run.",
    ],
    rules: [
      "In the browser, a tab joins the channel only while a Game is live or about to start, and leaves when the last one finishes.",
      "It gets a short-lived access token from getRealtimeToken, never the refresh token, and refreshes it 5 minutes before it expires.",
      "If the channel drops, it rejoins (2 s, doubling to 60 s), then refetches Games once in case it missed an update.",
    ],
    files: [
      "src/features/afl-tipping/sync/live-ingest.ts",
      "src/features/afl-tipping/api/live-scores.realtime.ts",
      "src/features/afl-tipping/hooks/use-live-scores.ts",
      "supabase/migrations/20261125110000_squiggle_live_and_schedule.sql",
    ],
    adr: [10, 5],
    why: "Why: the earlier relay opened one Squiggle connection per open tab. Now it's one for the site, and Supabase holds the tabs' connections.",
  },
  {
    id: "security",
    title: "Who can read what",
    intro:
      "The browser has the publishable key, which is public by design, and a session cookie. Neither can read a table. Everything goes through the server, except one Realtime channel.",
    rules: [
      "Every table has row-level security on and no policies. A new table's migration must turn RLS on too.",
      "The secret key is only ever on the server. No secret may have a VITE_ prefix, because Vite builds every VITE_* variable into the browser bundle.",
      "The lease, cron and trigger functions have execute revoked from anon and authenticated. Without that, the public API could call them.",
      'Realtime\'s "Allow public access" is off, so only private channels work. The one realtime.messages policy lets signed-in users receive on one topic. Nobody can send.',
      "The sync endpoints compare the Bearer secret in constant time. A missing secret answers 503, a wrong one 401.",
    ],
    files: [
      "supabase/migrations/20261015120000_enable_rls_lockdown.sql",
      "src/lib/supabase.ts",
      "src/features/afl-tipping/sync/authorize-sync-request.ts",
      "src/features/auth/api/realtime-token.ts",
    ],
    adr: [2],
    why: "Why: before the lockdown, anyone could take the publishable key from the page and read every Tip before Lockout. One gate, the server functions, is easier to get right than many policies.",
  },
  {
    id: "demo",
    title: "The Demo",
    intro:
      "The public Demo is the same site, built with VITE_DEMO=true. It runs entirely in the visitor's browser over a 2026 snapshot, with no Supabase, no Squiggle and no sign-in.",
    rules: [
      "New data has to reach components through the service registry, or the Demo won't have it.",
      'A Demo-only import is gated with the condition written out (import.meta.env.VITE_DEMO === "true"), so the live build drops it.',
      "The Demo keeps no query cache in the browser. Each visit starts fresh.",
    ],
    files: [
      "src/features/afl-tipping/demo/start-demo.ts",
      "src/features/afl-tipping/demo/squiggle.service.demo.ts",
      "src/features/afl-tipping/demo/snapshot.ts",
      "docs/releasing-the-demo.md",
    ],
    adr: [4],
    why: "Why in the browser: a Demo with no server, database or sign-in can't leak real Tips, costs nothing to run, and can't break the live site.",
  },
];

export const ADRS: readonly Adr[] = [
  { number: 1, title: "A missed Tip becomes a Home-team Auto-tip." },
  { number: 2, title: "Supabase is reached only from the server, and RLS denies everyone else." },
  {
    number: 3,
    title: "Every App lives on one origin, so the Hub and each App can be installed as a PWA.",
  },
  { number: 4, title: "The Demo runs in the browser over a snapshot." },
  { number: 5, title: "Live scores came through the site's own relay. Replaced by 0010." },
  {
    number: 6,
    title: "Supabase Auth replaces Clerk: invite-only, with cookies only the server touches.",
  },
  { number: 7, title: "Tipsters enter each Season's Competition by opening the App during it." },
  { number: 8, title: "Times show in the viewer's time zone." },
  { number: 9, title: "Squiggle is read on a schedule, never because a visitor opened a page." },
  { number: 10, title: "Live scores come from one ingest connection, through Supabase Realtime." },
];
