# Hot Shots

A site of sports tipping games: friends tip the winner of each game in a season and are ranked
on how often they're right.

## Language

### The site

**Hub**:
The site's home page, which lists every App.
_Avoid_: home, landing page, portal

**App**:
One installable tipping game on the site, such as AFL Tipping.
_Avoid_: site, module, product

**Demo**:
The public copy of the site, where a visitor plays through a past Season in their own browser
against made-up Tipsters.
_Avoid_: sandbox, staging, preview (Vercel's preview deployments are something else)

**Demo clock**:
The moment in that Season the Demo is showing. The Time control moves it.
_Avoid_: simulated date, time machine

**Profile**:
A person on the site, with the name and photo every App shows for them. A Profile isn't a
Tipster until they open an App.
_Avoid_: account, user, member

**Invitation**:
Permission for one email address to join the site. Nobody can sign in for the first time without
one.
_Avoid_: invite code, allowlist, whitelist

### People and the competition

**Tipster**:
A person who tips in a Competition. A Profile becomes a Tipster in an App, and has joined it, the
first time they open that App.
_Avoid_: player (AFL players are the footballers), user, member

**Competition**:
One Season of an App's tipping game. Every Tipster is in it.
_Avoid_: group, league, comp

### The season

**Game**:
One match between two teams.
_Avoid_: match, fixture

**Home team**:
The team the AFL lists as hosting a Game, even at a neutral venue.
_Avoid_: host team

**Round**:
The AFL's grouping of Games, from Opening Round through the Grand Final.
_Avoid_: week

**Season**:
One year's Rounds.
_Avoid_: year

**Finals**:
The Rounds after the home-and-away Rounds, ending in the Grand Final.
_Avoid_: playoffs, finals series

**Fixture**:
A Season's full schedule of Games. Never a single Game.
_Avoid_: schedule, draw (a Draw is a level result)

### The Model

**Model**:
Squiggle's tipping model, whose picks every Tipster can see and tip against.
_Avoid_: prediction, AI, computer

**Model tip**:
The Model's pick of the winner of a game.
_Avoid_: prediction, model prediction

**Favourite**:
The team the Model tips to win a game.
_Avoid_: bookmaker favourite, predicted winner

**Underdog**:
The team the Model doesn't tip to win a game.
_Avoid_: outsider, long shot

**Underdog tip**:
A Tip against the Model tip as it stood when the Tip was made. It stays an Underdog tip even if
the Model later changes its pick. A Tip made before the Model has tipped the Game is neither an
Underdog tip nor a Favourite tip.
_Avoid_: upset tip, contrarian tip

**Underdog quota**:
The two Underdog tips each Tipster is expected to make every round, outside finals. Missing it is
called out, but doesn't cost points.
_Avoid_: underdog minimum, compliance

### Tipping and scoring

**Tip**:
A Tipster's pick of the team to win a Game.
_Avoid_: pick, prediction, selection

**Auto-tip**:
The Tip a Tipster gets for a Game they hadn't tipped by Lockout: the Home team. Only Games whose
Lockout comes after the Tipster joined get one. It counts like any other Tip, except that it is
never an Underdog tip, and it is shown as an Auto-tip wherever Tips are shown.
_Avoid_: default tip, missed tip

**Correct tip**:
A Tip on the team that won the Game.
_Avoid_: win, hit

**Score**:
A Tipster's number of Correct tips in a Season.
_Avoid_: points (points are what AFL teams kick), total

**Accuracy**:
The share of a Tipster's Tips on completed Games that were Correct tips.
_Avoid_: strike rate, hit rate

**Perfect round**:
A Round in which every one of a Tipster's Tips was a Correct tip.
_Avoid_: gold star, clean sweep

**Streak**:
A run of consecutive Correct tips, in Game start order. A wrong Tip ends it; a Game the Tipster
has no Tip on is skipped. The **Longest streak** is a Tipster's best in the Season.
_Avoid_: run, form

**Lockout**:
The moment a game starts. Until then a tip can be changed and other Tipsters can't see it; from
then on it is fixed and visible to everyone.
_Avoid_: deadline, cut-off

**Margin game**:
The first game of a round by start time: the one game where Tipsters also tip a Margin.
_Avoid_: first game, tiebreaker game

**Margin**:
The winning margin, in points, a Tipster tips for their team in the Margin game. A Tip without
one, Auto-tips included, has a Margin of 0.
_Avoid_: spread, points tip

**Margin difference**:
How far a Tipster's Margin was from the result. Tipping the wrong team adds the real margin to the
tipped one. The lowest season total breaks ties on the Leaderboard.
_Avoid_: margin error, tiebreaker score

**Draw**:
A game that ends level. Every tip on it is wrong.
_Avoid_: tie

### Rankings

**Ladder**:
The AFL's table of teams, ranked by premiership points.
_Avoid_: standings, table

**Leaderboard**:
The ranking of Tipsters in a Competition: by Score, then by lowest Margin difference. Tipsters
still level share the rank.
_Avoid_: standings, ladder, rankings
