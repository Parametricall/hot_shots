# Agent skills: committed and personal

Skills come from two places, and which one depends on whether the skill reads this repo:

- **Committed** (`.claude/skills/<name>/`, listed in `skills-lock.json`): skills that read the
  repo's own docs (`GLOSSARY.md`, `docs/adr/`, `docs/agents/`) or run its workflow: the
  `mattpocock/skills` set, `improve`, `shadcn`. They travel with the repo, so cloud sessions and CI
  have them too.
- **Personal** (`~/.claude/skills/`, installed with `-g`): skills that would work the same in any
  repo, like the `jakubkrehel/skills` `better-*` set. They're on your machine only.

## Adding or updating a committed skill

Install with `--copy`, not the default symlink:

```bash
npx skills add <owner/repo> -s <skill> -a claude-code --copy -y
npx skills update -p
```

The default links `.claude/skills/<name>` to `.agents/skills/<name>` with an absolute Windows path,
which is broken anywhere else, and git here doesn't follow symlinks (`core.symlinks=false`).

Then:

1. Check `.claude/skills/` still holds folders, not links (`ls -la .claude/skills`). If an update
   turned one back into a link, rerun its `add` with `--copy`.
2. Read the diff for repo files the skills name, such as `GLOSSARY.md` or `docs/agents/*.md`, and
   check that each one still exists. When upstream renames one, rename ours to match. Editing the
   skill instead only lasts until the next update overwrites it.
3. Commit with the `skills:` scope, keeping a repo rename in its own commit.

`vp fmt` and `vp lint` both ignore `.claude/`, so skills stay exactly as their authors wrote them
and an update's diff shows only upstream changes.

## Skills not in the lock

`resolving-merge-conflicts` was copied in by hand: `mattpocock/skills` dropped it upstream, so
`npx skills update` won't touch it. Update or remove it by hand.
