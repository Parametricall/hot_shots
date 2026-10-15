# Missed tips become home-team Auto-tips

A Tipster who hasn't tipped a Game by Lockout gets an Auto-tip on the Home team, so forgetting
costs something without knocking a Tipster out of the Competition. The Home team is a neutral pick
that wins only somewhat more often than not; the Model tip would hand a forgetful Tipster the best
pick available, making not tipping an advantage.

An Auto-tip counts like any other Tip, except that it is never an Underdog tip: the Underdog quota
rewards choosing to tip against the Model, and forgetting isn't choosing. Only Games whose Lockout
comes after the Tipster joined get one, so joining mid-Season doesn't backfill Rounds the Tipster
never saw.

## Considered options

| Option                     | Why not                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| No tip: a missed Game is 0 | One forgotten Round puts a Tipster out of contention for the Season   |
| The Model tip              | Usually the likeliest winner, so not tipping would beat tipping blind |
| The Home team              | Chosen                                                                |

## Consequences

- An Auto-tip on the Margin game has a Margin of 0, like a Tip with no Margin entered. That can
  still make not tipping the Margin game an advantage: a Margin of 0 never overshoots, while a
  Tipster who tips the wrong team pays for both. If that shows up in practice, default the Margin
  to the largest winning margin in the Round instead.
- A Tipster who signs up and never tips still collects home-team Correct tips. Accepted, to keep
  the rule simple.
