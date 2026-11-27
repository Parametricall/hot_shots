import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ADRS, TOPIC_IDS, TOPICS } from "~/features/architecture/topics";

const REPO_ROOT = process.cwd();
const ADR_FILES = readdirSync(path.join(REPO_ROOT, "docs", "adr"));

const hasAdrFile = (number: number) =>
  ADR_FILES.some((file) => file.startsWith(`${String(number).padStart(4, "0")}-`));

describe("TOPICS", () => {
  it("has the expected ids, in order", () => {
    expect(TOPICS.map((topic) => topic.id)).toEqual([
      "reading",
      "sign-in",
      "tipping",
      "scoring",
      "squiggle-sync",
      "live-scores",
      "security",
      "demo",
    ]);
    expect([...TOPIC_IDS]).toEqual(TOPICS.map((topic) => topic.id));
  });

  it("has unique ids", () => {
    expect(new Set(TOPICS.map((topic) => topic.id)).size).toBe(TOPICS.length);
  });

  it("gives every Topic a title, intro, why, file and ADR", () => {
    for (const topic of TOPICS) {
      expect(topic.title).not.toBe("");
      expect(topic.intro).not.toBe("");
      expect(topic.why).not.toBe("");
      expect(topic.files.length).toBeGreaterThan(0);
      expect(topic.adr.length).toBeGreaterThan(0);
    }
  });

  it.each(TOPICS.flatMap((topic) => topic.files.map((file) => [topic.id, file] as const)))(
    "%s names a file that exists: %s",
    (_id, file) => {
      expect(existsSync(path.join(REPO_ROOT, file))).toBe(true);
    },
  );

  it.each(TOPICS.flatMap((topic) => topic.adr.map((number) => [topic.id, number] as const)))(
    "%s cites ADR %i, which exists",
    (_id, number) => {
      expect(hasAdrFile(number)).toBe(true);
    },
  );
});

describe("ADRS", () => {
  it("lists every file in docs/adr, in order", () => {
    const onDisk = ADR_FILES.filter((file) => /^\d{4}-.*\.md$/.test(file)).map((file) =>
      Number(file.slice(0, 4)),
    );
    expect(ADRS.map((adr) => adr.number)).toEqual(onDisk);
  });
});
