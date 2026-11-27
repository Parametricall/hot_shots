# Plan 016: A public architecture page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. Steps marked **OPERATOR** need a decision or a
> dashboard only the operator has: stop, say exactly what is needed, and
> wait. When done, update the status row for this plan in `plans/README.md`,
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git log --oneline 981deee..HEAD -- src/routes src/features/hub src/features/afl-tipping/sync src/features/afl-tipping/api docs/adr`.
> Anything listed may have changed how the parts connect. Re-check the
> diagrams in `plans/016-architecture-reference.html` against the code before
> Step 4, and note any change in "Notes".

## Status

- **Priority**: P2. Nothing depends on it, but it's most useful before people
  start looking at the Demo, the README's first link.
- **Effort**: M
- **Risk**: LOW. It's a new page with no data, no server function and no
  migration. The one real risk is the page drifting out of date (Step 3 and
  Step 8 deal with that).
- **Depends on**: plan 015 being merged, because the page describes the system
  as plan 015 left it. It has been merged.
- **Category**: feature / docs
- **Planned at**: commit `981deee`, 2026-11-27, from the operator's request:
  "is it worth adding that architecture artifact into the codebase and maybe
  showing it on the help page or a new architecture page? I feel like it would
  be a good addition to the demo app that recruiters and employers could see."

## Why this matters

Hot Shots is the operator's portfolio as well as a tipping site. The Demo
shows what the app does. Nothing shows how it's built: the boundaries, the
trade-offs, and the ADRs behind them. A recruiter or an engineer reviewing
the repo has to read the code to find out. An architecture page makes that
visible in two minutes, and links to the code and ADRs for anyone who wants
more.

The operator explored the content as a published artifact first. Its source
is now in the repo as `plans/016-architecture-reference.html`: an overview map
and eight topics, each with a diagram, steps, files and the ADR behind it.
This plan turns it into a page of the site.

## The model

- **Architecture page**: the page at `/architecture` that explains how the
  site is built. It belongs to the site, not to an App, like the Hub and the
  privacy page. It isn't a domain term, so it doesn't go into `GLOSSARY.md`.
- **Topic**: one of the page's eight sections. The overview map links to them.

The eight Topics, in order, with the reference's anchors as their ids:

| Topic id        | Title                       | Diagram                                   |
| --------------- | --------------------------- | ----------------------------------------- |
| `reading`       | Opening a page              | Sequence: cache, server function, tables  |
| `sign-in`       | Signing in                  | Sequence: browser, server, Auth, Google   |
| `tipping`       | Submitting a Tip            | Flowchart of `judgeTip`                   |
| `scoring`       | Auto-tips & the Leaderboard | Data flow into `assembleLeaderboard`      |
| `squiggle-sync` | The Squiggle sync           | The scheduled loop, plus a cadence table  |
| `live-scores`   | Live scores                 | One goal end to end, plus a run timeline  |
| `security`      | Who can read what           | Boundaries: allowed and refused paths     |
| `demo`          | The Demo                    | Live site and Demo, split at the registry |

## Current state (verified at `981deee`)

| Where                                                                 | What it does today                                                                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/index.tsx`                                                | The Hub, public. `head()` links `hub.webmanifest`.                                                                                |
| `src/features/hub/pages/hub.tsx`                                      | The Hub page. Its footer has one link, Privacy.                                                                                   |
| `src/routes/privacy.tsx`                                              | A public page outside `_authenticated`, with its component in the route file. The pattern to copy for a public page.              |
| `src/routes/_authenticated/afl-tipping/$season/how-tipping-works.tsx` | The help page, for Tipsters learning the rules. Not the audience for this page.                                                   |
| `src/styles/app.css`                                                  | shadcn tokens (`--card`, `--border`, `--primary`, `--muted-foreground`, `--destructive` …), with a `.dark` variant.               |
| `README.md`                                                           | Opens with a link to the live Demo (`hot-shots-demo.vercel.app`).                                                                 |
| `docs/releasing-the-demo.md`                                          | The Demo deploys from the `demo` branch, which is fast-forwarded to a commit on `main`.                                           |
| `plans/016-architecture-reference.html`                               | The explored design: SVG diagrams with exact coordinates, and the copy for every Topic. Written for the operator ("your server"). |
| Repo                                                                  | Public on GitHub, `Parametricall/hot_shots`. The page reveals nothing the repo doesn't.                                           |

## Decisions

All are recommendations. The operator confirms or changes them in Step 1.

- **D1. The page is public on both the live site and the Demo.** The Demo is
  the same site built with `VITE_DEMO=true`, so one public route serves both.
  The live site is invite-only, but this page holds no data, and everything it
  says is already in the public repo.
  _Rejected_: Demo only. It needs a Demo-only route gate, and a recruiter who
  is sent the live URL finds nothing.
- **D2. One route, `/architecture`, with the Topic in a search param**
  (`/architecture?topic=live-scores`). Links to a Topic can be shared, the page
  renders on the server with the right Topic open, and there's one `head()`.
  _Rejected_: one route per Topic. Eight route files for one page, and the
  overview map would have to be repeated or put in a layout.
  _Rejected_: the reference's `#hash` links. The server never sees a hash, so
  the first render would always show the first Topic.
- **D3. The page adds a "Stack and testing" section** for the reader this page
  is for: the stack (React 19, TanStack Start and Router, TanStack Query,
  Supabase, Vercel, Tailwind v4 and shadcn/ui, Zod), how it's tested (Vitest
  unit and component tests, Storybook, the Demo as a full end-to-end copy) and
  links to the repo, the ADRs and `AGENTS.md`. Test counts are not hard-coded,
  because they go stale.
- **D4. It looks like Hot Shots, not like the artifact.** Diagrams use the
  app's shadcn tokens through Tailwind classes (`fill-card`,
  `stroke-border`, `fill-muted-foreground` …), so they follow the app's light
  and dark themes. Highlights use one token, `--primary` or `--destructive`;
  the operator picks in Step 1. The artifact's Sherrin-red palette and fonts
  don't come across.
- **D5. Accuracy is enforced, not hoped for.** Every file path and ADR number
  the page names lives in one data module. A test fails if a named file or
  ADR doesn't exist. `AGENTS.md` gains a rule: an ADR that changes how parts
  connect updates the Architecture page in the same change.
- **D6. The copy is rewritten for outsiders.** Third person ("the server", not
  "your server"). No operator-only details: no release steps, no Vercel plan
  limits, no secret names beyond what the code shows. `GLOSSARY.md` terms
  throughout (Tipster, Lockout, Margin game, Ladder).

## Scope

In:

- `src/features/architecture/`: the Topics data module, the diagram
  components, the page.
- `src/routes/architecture.tsx`: the public route.
- A link from the Hub's footer, a line in `README.md`, the `AGENTS.md` rule.
- Stories for each diagram, and tests for the data module, the Topic search
  param and the page.

Out:

- Generating diagrams from the code. The value is in choosing what to show.
- Analytics on who views the page.
- A printable or PDF version.
- Changing the help page (`how-tipping-works`).

## Git workflow

Branch `advisor/016-architecture-page`, from `main` once plan 015's last
docs commits are on it, or from `advisor/015-squiggle-sync`. Commit after
each step whose checks pass, following `AGENTS.md` ("Commits"). Scope
`architecture` for the feature folder, `routes` for the route, `hub` for the
footer link, `repo` for `README.md`, `AGENTS.md` and docs. Don't push. The
operator does.

## Steps

### Step 1: OPERATOR — decisions

1. Confirm D1–D6, or say which to change.
2. D4: should the highlight use `--primary` (the app's near-black) or
   `--destructive` (its red)? Or add a new `--highlight` token?
3. D3: confirm the GitHub URL to link: `https://github.com/Parametricall/hot_shots`.

### Step 2: Read the reference

Open `plans/016-architecture-reference.html` in a browser and click through
all eight Topics. Then read its source. It is the specification for:

- every diagram's shapes, coordinates, labels and `aria-label`;
- every Topic's intro, steps, rules, "Where it lives" files and "Why" line;
- which overview nodes and edges light up for each Topic (`data-topic`).

Don't copy its `<style>` or `<script>`. Only the SVG geometry and the copy
come across.

### Step 3: The Topics data module (test-first)

`src/features/architecture/topics.ts` exports `TOPICS`, an ordered list of
`{ id, title, intro, steps?, rules?, files, adr, why }`, plus `TopicId`, a
union of the eight ids. Copy the text from the reference, rewritten per D6.

`topics.test.ts`:

- every `files` path exists in the repo (`fs.existsSync` from the repo root);
- every `adr` number matches a file `docs/adr/<number>-*.md`;
- ids are unique, and match the list in "The model".

**Verify**: `npm run test:ci` passes. Then rename one path in the module and
check the test fails, and undo the rename.

### Step 4: Diagram primitives

`src/features/architecture/diagram/`:

- `Box` (rect plus a title and up to two sub-lines, or a mono line),
  `Edge` (line or path, with `ret` for dashed returns, `refused` for the
  security diagram's dashed red, `both` for two heads), `EdgeLabel` (text
  with a halo in the background token), `Lifeline`, `Arrowheads` (the
  `<marker>` defs).
- Marker ids come from React's `useId()`, so two diagrams on one page can't
  clash.
- Colors come only from Tailwind classes on the shadcn tokens (D4). No hex
  values. Check both themes in Storybook.
- Each SVG keeps the reference's `viewBox`, has `role="img"` and the
  reference's `aria-label`, and sits in an `overflow-x-auto` wrapper with a
  `min-width` (the reference uses 780px for the overview, 640px for the rest),
  so it scrolls on a phone instead of shrinking past legibility.

**Verify**: a story for each primitive, in light and dark.
`npm run typecheck`, `npm run check`.

### Step 5: The nine diagrams

One component per diagram, in `src/features/architecture/diagrams/`, built
from the primitives with the reference's coordinates:

- `OverviewMap`: its nodes are `<Link to="/architecture" search={{ topic }}>`
  (TanStack Router `Link` inside SVG renders an `<a>`, which is valid SVG).
  It takes the current `TopicId` and highlights the nodes and edges tagged
  with it, as the reference's `data-topic` does. Keyboard focus shows on the
  box.
- `ReadingSequence`, `SignInSequence`, `TippingFlow`, `ScoringFlow`,
  `SyncLoop`, `LiveFlow`, `LiveTimeline`, `SecurityBoundaries`, `DemoSplit`.

Copy the reference's labels, rewritten per D6 where they say "your". Keep
its fixes: the security diagram's refused path starts at x=180 so it misses
the lane label, and its Realtime path runs up the right margin (x=763) so it
misses the pg_cron box.

**Verify**: a story per diagram. In Storybook, at 400px wide and in both
themes: no label overflows its box, and nothing overlaps.
`npm run test:ci` (render each diagram once in a component test, and check
its `aria-label`).

### Step 6: The page and the route

- `src/features/architecture/pages/architecture.tsx`: the header ("How Hot
  Shots is built", one sentence on the four places code runs), the
  `OverviewMap`, the Topic chips (links with the `topic` search param,
  `aria-current` on the current one), the current Topic's section (diagram,
  steps or rules, "Where it lives" with each file linked to GitHub at `main`,
  "Why" with its ADR linked), the "Stack and testing" section (D3), and the
  ADR list from the reference (each linked to its file on GitHub).
- `src/routes/architecture.tsx`: public (not under `_authenticated`),
  `validateSearch` with `z.enum(TOPIC_IDS).catch("reading")` so an unknown
  Topic falls back instead of erroring, `head()` with the title
  "How it's built | Hot Shots" and a meta description. Like `privacy.tsx`,
  the page root gets `data-app-ready`.
- Picking a Topic from the map scrolls its section into view, except on first
  load. Respect `prefers-reduced-motion`.

Tests: the route falls back to `reading` for an unknown Topic, chips mark the
current Topic, the map highlights the current Topic's nodes.

**Verify**: `npm run test:ci`, `npm run typecheck`, `npm run check`,
`npm run build`. `npm run dev`, then signed out: `/architecture` opens, every
Topic opens from the map and the chips, a shared
`/architecture?topic=security` link opens on that Topic, and the back button
steps through Topics.

### Step 7: Links

- Hub footer (`src/features/hub/pages/hub.tsx`): "How it's built" next to
  Privacy. Update `hub.test.tsx` and its story if they check the footer.
- `README.md`: one line under the Demo link, pointing at
  `https://hot-shots-demo.vercel.app/architecture`.
- `npm run dev:demo`: the Hub's link works there too, and the page renders
  with no data.

**Verify**: `npm run test:ci`, `npm run check`.

### Step 8: Docs

- `AGENTS.md`, under "Code Conventions" or a short "Architecture page"
  note: "An ADR or change that alters how parts connect (a new service, an
  external call, a boundary) updates `src/features/architecture/` in the same
  change. `topics.test.ts` fails if a named file disappears." Keep it to two
  lines in `AGENTS.md`'s style.
- `docs/README.md`: a row for the page ("You want the big picture, or to show
  someone how it's built").
- `docs/releasing-the-demo.md`: in step 1's check, open `/architecture`.

### Step 9: OPERATOR — release

1. Merge to `main`, which deploys the live site.
2. Release the Demo: `git push origin main:demo` (`docs/releasing-the-demo.md`).
3. On a phone, open `https://hot-shots-demo.vercel.app/architecture` signed
   out. Check that the map scrolls sideways inside its box and the page
   doesn't. Open two Topics.
4. Delete `plans/016-architecture-reference.html` in its own commit.

### Step 10: Update the plans index

Set this plan's row in `plans/README.md` to DONE.

## Done criteria

- `/architecture` opens signed out on the live site and on the Demo.
- Every Topic opens from the map and from the chips, and a link to a Topic
  opens on it.
- The diagrams follow the app's light and dark themes, with no hard-coded
  colors.
- `topics.test.ts` fails if a named file or ADR is missing.
- The Hub and the README link to the page.
- `npm run check`, `npm run typecheck`, `npm run test:ci`, `npm run build` pass.

## STOP conditions

- The drift check shows that plan 015 or later changed how the parts connect,
  and the reference doesn't show it. Report what changed before drawing it.
- A TanStack Router `Link` inside an SVG doesn't render a working `<a>`. Then
  use a plain SVG `<a href>` built with the router's `buildLocation`, and say
  so in "Notes".
- A diagram can't stay legible at its `min-width` without changing what it
  shows. Ask the operator before cutting content.

## Notes

- The reference was published as a private artifact on 2026-11-27, in the
  conversation that planned this. Its copy addresses the operator ("your
  server", "your tables"). D6 rewrites it. It also says, correctly, that the
  gap between live runs is about 10 seconds, not up to a minute as an earlier
  conversation estimated.
- Steps 2-8 ran on 2026-11-27 without the operator, who asked for questions
  to wait until the end. Step 1 took D1-D6 as recommended, D4's highlight as
  `--primary` (`--destructive` already marks refused paths in the security
  diagram) and D3's URL as written. The operator confirms or changes them.
- Drift check at 9204887: nothing listed.
- TanStack Router `Link` inside the SVG renders a working `<a>`; no
  `buildLocation` fallback. The overview map's `<svg>` takes `role="group"`
  rather than `role="img"`, so its links stay reachable by assistive tech.
- The overview map has no node for `scoring` or `demo` (as in the
  reference). Those two Topics open from the chips only.
- `/architecture` with no `topic` redirects (307) to `?topic=reading`: the
  router writes the default into the URL.
- D6 went further than "your": "our" is gone too (the guard in
  `diagrams.test.tsx` rejects it), "SQUIGGLE · NOT OURS" reads
  "SQUIGGLE · EXTERNAL", and hard-coded Season years in captions read "next
  year's Fixture" and "bundled Season snapshot".
