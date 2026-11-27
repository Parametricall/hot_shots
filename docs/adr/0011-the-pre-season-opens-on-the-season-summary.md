# The Pre-season opens on the Season summary, not My Tips

Opening AFL Tipping lands on My Tips only while the Current Season is in progress or its first
Game is at most 14 days away (`TIPS_LANDING_LEAD_MS`). Before that, in the Pre-season, it lands on
the Season summary, which shows who is tipping. Once the Season is over it lands on the summary,
as before. Tipping itself is open the whole time: the summary links to My Tips.

The Season switcher follows the same rule. Picking the Current Season lands where opening the App
would; picking any other Season lands on its summary instead of keeping the tab that was open.

This reverses D2 of plan 014, which landed an upcoming Season on My Tips from the moment its
Fixture came out and rejected a lead time as "a constant and a branch for little gain". In
practice the Fixture comes out late in the year, so for three months the App opened on a Round
nobody was thinking about yet, and switching to last Season showed the tips of its final Round
instead of who won.

## Considered options

| Option                                               | Why not                                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Land on My Tips as soon as the Fixture is out (D2)   | Months of opening on an empty Round; nothing to look at before the Season but a list of Games                  |
| Land on My Tips from 14 days before the first Game   | Chosen                                                                                                         |
| Land on My Tips only once the first Game has started | Opening Round has to be tipped before its first Game, so Tipsters would miss the push when it matters the most |
| Keep the open tab when switching Season              | Switching to a finished Season showed its last Round's tips, when its result is what anyone wants to see       |

## Consequences

- **Entering a Season doesn't change.** The Season summary loads the Leaderboard, which enters the
  Tipster (`docs/adr/0007`), so the Pre-season summary's list of who's tipping fills up as people
  open the App over summer.
- **The window is measured on the Demo clock in the Demo**, since `landingFor` takes `now`.
- **14 days is a guess.** It is one constant; change it there.
