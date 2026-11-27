import { useLinkProps } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { buttonVariants } from "~/components/ui/button";
import { OVERVIEW_CAPTION, OverviewMap } from "~/features/architecture/diagrams/overview-map";
import { SyncCadenceTable } from "~/features/architecture/diagrams/sync-cadence-table";
import { TOPIC_DIAGRAMS } from "~/features/architecture/diagrams/topic-diagrams";
import { ADR_FOLDER_URL, adrUrl, githubBlobUrl, REPO_URL } from "~/features/architecture/github";
import { ADRS, TOPICS, type Topic, type TopicId } from "~/features/architecture/topics";
import { cn } from "~/lib/utils";

type ArchitecturePageProps = {
  /** The Topic being read, from the `topic` search param. */
  topic: TopicId;
};

const STACK: readonly { name: string; role: string }[] = [
  { name: "React 19", role: "the interface" },
  { name: "TanStack Start and Router", role: "file-based routes and server functions" },
  { name: "TanStack Query", role: "server state, cached in the browser" },
  { name: "Supabase", role: "Postgres, Auth and Realtime" },
  { name: "Vercel", role: "hosting for the server" },
  { name: "Tailwind CSS v4 and shadcn/ui", role: "styling and components" },
  { name: "Zod", role: "validating what Squiggle sends and what the server receives" },
];

const TESTING: readonly string[] = [
  "Vitest unit and component tests, next to the code they cover.",
  "Storybook stories for components and diagrams, including this page's.",
  "The Demo: the whole site running in the browser over a snapshot, so every page can be exercised end to end with no accounts or live data.",
];

const SECTION_HEADING = "text-lg font-semibold";
const EXTERNAL_LINK = "underline underline-offset-2 hover:text-primary";

type ExternalLinkProps = { href: string; className?: string; children: string };

const ExternalLink = ({ href, className, children }: ExternalLinkProps) => (
  <a className={cn(EXTERNAL_LINK, className)} href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
);

const FIRST_TOPIC = TOPICS[0] as Topic;

type TopicChipProps = { topic: Topic; current: boolean };

/**
 * A link to one Topic. The router only marks a link `aria-current` when the URL's search matches
 * exactly, so a bare `/architecture` would leave the first Topic's chip unmarked. The attribute is
 * set here from the page's own idea of the current Topic instead.
 */
const TopicChip = ({ topic, current }: TopicChipProps) => {
  const linkProps = useLinkProps({ to: "/architecture", search: { topic: topic.id } });
  return (
    <a
      {...linkProps}
      aria-current={current ? "true" : undefined}
      className={buttonVariants({ variant: current ? "default" : "outline", size: "sm" })}
    >
      {topic.title}
    </a>
  );
};

/**
 * Picking a Topic scrolls its section into view, except on first load, where the page is already
 * at the top. A visitor who prefers reduced motion jumps instead of gliding.
 */
const useScrollToTopic = (topic: TopicId) => {
  const sectionRef = useRef<HTMLElement>(null);
  const previous = useRef(topic);

  useEffect(() => {
    if (previous.current === topic) return;
    previous.current = topic;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [topic]);

  return sectionRef;
};

export const ArchitecturePage = ({ topic }: ArchitecturePageProps) => {
  const sectionRef = useScrollToTopic(topic);
  const current = TOPICS.find((t) => t.id === topic) ?? FIRST_TOPIC;
  const diagrams = TOPIC_DIAGRAMS[current.id];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4 sm:p-6" data-app-ready>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">How Hot Shots is built</h1>
        <p className="max-w-3xl text-muted-foreground">
          The code runs in four places: the Tipster&apos;s browser, the TanStack Start server on
          Vercel, the Supabase database, and Squiggle, the AFL data service. Click a box on the map,
          or a topic under it, to open that part of the system.
        </p>
      </header>

      <figure className="flex flex-col gap-2">
        <OverviewMap current={current.id} />
        <figcaption className="text-sm text-muted-foreground">{OVERVIEW_CAPTION}</figcaption>
      </figure>

      <nav aria-label="Topics" className="flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <TopicChip key={t.id} topic={t} current={t.id === current.id} />
        ))}
      </nav>

      <section
        ref={sectionRef}
        id={current.id}
        aria-labelledby={`${current.id}-title`}
        className="flex scroll-mt-4 flex-col gap-6"
      >
        <div className="flex flex-col gap-2">
          <h2 id={`${current.id}-title`} className="text-2xl font-bold">
            {current.title}
          </h2>
          <p className="max-w-3xl">{current.intro}</p>
        </div>

        {diagrams.map(({ Diagram, caption }) => (
          <figure key={caption} className="flex flex-col gap-2">
            <Diagram />
            <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
          </figure>
        ))}

        {current.id === "squiggle-sync" && (
          <div className="flex flex-col gap-2">
            <h3 className={SECTION_HEADING}>What it fetches, and how often</h3>
            <SyncCadenceTable />
          </div>
        )}

        {current.steps && (
          <div className="flex flex-col gap-2">
            <h3 className={SECTION_HEADING}>How it works</h3>
            <ol className="flex max-w-3xl list-decimal flex-col gap-2 pl-6">
              {current.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {current.rules && (
          <div className="flex flex-col gap-2">
            <h3 className={SECTION_HEADING}>{current.steps ? "Rules" : "How it works"}</h3>
            <ul className="flex max-w-3xl list-disc flex-col gap-2 pl-6">
              {current.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className={SECTION_HEADING}>Where it lives</h3>
          <ul className="flex flex-col gap-1">
            {current.files.map((file) => (
              <li key={file} className="break-all">
                <ExternalLink href={githubBlobUrl(file)} className="font-mono text-sm">
                  {file}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex max-w-3xl flex-col gap-2 rounded-lg border bg-card p-4">
          <h3 className={SECTION_HEADING}>Why</h3>
          <p>{current.why}</p>
          <p className="text-sm text-muted-foreground">
            {current.adr.length === 1 ? "Decision record: " : "Decision records: "}
            {current.adr.map((number, i) => {
              const adr = ADRS.find((a) => a.number === number);
              const label = `ADR ${String(number).padStart(4, "0")}`;
              return (
                <span key={number}>
                  {i > 0 && ", "}
                  {adr ? <ExternalLink href={adrUrl(adr.file)}>{label}</ExternalLink> : label}
                </span>
              );
            })}
          </p>
        </div>
      </section>

      <section aria-labelledby="stack-title" className="flex flex-col gap-4">
        <h2 id="stack-title" className="text-2xl font-bold">
          Stack and testing
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className={SECTION_HEADING}>Built with</h3>
            <ul className="flex flex-col gap-1">
              {STACK.map(({ name, role }) => (
                <li key={name}>
                  <strong>{name}</strong>
                  <span className="text-muted-foreground">, {role}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className={SECTION_HEADING}>How it&apos;s tested</h3>
            <ul className="flex list-disc flex-col gap-1 pl-6">
              {TESTING.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <p>
          Read the code in <ExternalLink href={REPO_URL}>the repository</ExternalLink>, the{" "}
          <ExternalLink href={ADR_FOLDER_URL}>decision records</ExternalLink>, or{" "}
          <ExternalLink href={githubBlobUrl("AGENTS.md")}>AGENTS.md</ExternalLink>, the guide the
          project&apos;s contributors and coding agents work from.
        </p>
      </section>

      <section aria-labelledby="adrs-title" className="flex flex-col gap-2">
        <h2 id="adrs-title" className="text-2xl font-bold">
          Decisions
        </h2>
        <p className="text-muted-foreground">
          Each decision record explains what was chosen and the alternatives it beat.
        </p>
        <ul className="flex max-w-3xl flex-col gap-2">
          {ADRS.map((adr) => (
            <li key={adr.number} className="flex gap-3">
              <span className="font-mono text-muted-foreground">
                {String(adr.number).padStart(4, "0")}
              </span>
              <ExternalLink href={adrUrl(adr.file)}>{adr.title}</ExternalLink>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};
