# Tipsters enter each Season's Competition by opening the App during it

A Tipster joins an App once (`afl_tipsters`, `docs/adr/0006`) but enters each Season's Competition
separately (`afl_competition_entries`, one row per Tipster per Season). They enter by opening AFL
Tipping while that Season is the Current Season and isn't over. A Season's Leaderboard lists only
the Tipsters who entered it, and Auto-tips start at entry, not at joining
(`docs/adr/0001`'s "joining mid-Season doesn't backfill" rule, applied Season by Season). Every Tip
also carries its Season (`afl_tipping.season`), and its `(user_id, season)` must match an entry.

Everyone who had joined when Seasons landed was entered in 2026 at their join date, so the 2026
Leaderboard didn't move.

## Considered options

| Option                                        | Why not                                                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every Tipster carries over to each Season     | Needs no new table, but a 2026 Tipster who never comes back would sit on the 2027 Leaderboard collecting home-team Auto-tips, and would probably "win" the Wooden spoon |
| Tipsters enter each Season by opening the App | Chosen                                                                                                                                                                  |

## Consequences

- **Viewing a past Season enters nothing.** A Tipster who opens the App only after a Season is over
  never enters it, and has no row on its Leaderboard.
- **The migration entered every Tipster who had joined, whenever they joined**, so someone who
  joined after the 2026 Grand Final is on the 2026 Leaderboard with no Tips. From then on, entry
  follows the rule above.
- **The server decides whether a Season is current** on every request (`getSeasons`, cached for a
  minute per server instance), because entering is a write.
- **A Season with no entries has an empty Leaderboard.** Until someone opens the App in the new
  Season, the Season summary says "No scores yet".
