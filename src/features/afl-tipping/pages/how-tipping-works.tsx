import type { ReactNode } from "react";
import { GameRules } from "~/features/afl-tipping/api/game-rules";

const UNDERDOGS = GameRules.MINIMUM_UNDERDOGS_PER_ROUND;

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b pb-4 last:border-b-0">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/**
 * The rules of AFL Tipping, in a Tipster's words, opened from ⋯ More. It is the player-facing copy
 * of `GLOSSARY.md` and `docs/adr/0001` (Auto-tips) and `0007` (entering a Competition): change it
 * when those rules change. The Underdog quota comes from `GameRules`, so it can't drift.
 */
export function HowTippingWorksPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4 pb-4" data-app-ready>
      <h1 className="text-xl font-semibold">How tipping works</h1>

      <Rule title="Tip every Game">
        <p>
          Pick the winner of each Game in the Round. Every <strong>Correct tip</strong> adds one to
          your Score. A Draw counts as wrong for everyone.
        </p>
      </Rule>

      <Rule title="Lockout">
        <p>
          Each Game locks when it starts. Until then you can change your Tip as often as you like,
          and nobody else can see it. From Lockout your Tip is fixed, and everyone&apos;s Tips show
          on the Round tab.
        </p>
      </Rule>

      <Rule title="The Margin game">
        <p>
          The first Game of each Round is the <strong>Margin game</strong>: as well as the winner,
          tip how many points they&apos;ll win by. Leave it blank and your Margin is 0.
        </p>
        <p>
          Your <strong>Margin difference</strong> is how far off you were. If your team wins,
          it&apos;s the gap between your Margin and the real one. If they lose, it&apos;s both added
          together.
        </p>
        <p>
          Say you tip Geelong by 20. Geelong win by 32: your Margin difference is 12. Geelong lose
          by 32: it&apos;s 52.
        </p>
      </Rule>

      <Rule title="The Leaderboard">
        <p>
          Tipsters are ranked by Score. Level on Score, the lowest total Margin difference for the
          Season goes higher. Still level, you share the rank.
        </p>
        <p>
          When the Season is over, last place gets the <strong>Wooden spoon</strong>. A Competition
          of three or fewer has no Wooden spoon, since everyone&apos;s on the podium.
        </p>
      </Rule>

      <Rule title="Underdogs">
        <p>
          The percentages on each Game are Squiggle&apos;s tipping <strong>Model</strong>. The team
          it tips is the <strong>Favourite</strong>, the other is the <strong>Underdog</strong>.
        </p>
        <p>
          Tip at least {UNDERDOGS} Underdogs every Round, Finals aside. Missing the quota
          doesn&apos;t cost points, but it&apos;s called out. Don&apos;t be a shit bloke.
        </p>
        <p>
          A Tip counts as an Underdog tip if it went against the Model when you made it, even if the
          Model changes its mind later. A Tip made before the Model has tipped the Game is neither.
        </p>
      </Rule>

      <Rule title="Forgot to tip?">
        <p>
          If a Game locks without your Tip, you get an <strong>Auto-tip</strong> on the Home team.
          It scores like any other Tip, but it&apos;s never an Underdog tip, and on the Margin game
          its Margin is 0.
        </p>
        <p>
          You join a Season&apos;s Competition the first time you open AFL Tipping during that
          Season. Auto-tips only start from then, so joining mid-Season doesn&apos;t give you Tips
          for Rounds already played.
        </p>
      </Rule>
    </article>
  );
}
