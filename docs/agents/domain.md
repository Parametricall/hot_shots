# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the one glossary for every app on the site.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.
- **`AGENTS.md`**: where things live, and the conventions to follow.

Neither `GLOSSARY.md` nor `docs/adr/` exists until there's something to write in it: if one is
missing, carry on without it, and don't create it just to have it.

## File structure

This is a single-context repo: one glossary and one ADR folder, shared by every app.

```text
/
├── AGENTS.md
├── GLOSSARY.md
├── docs/
│   ├── adr/        # 0001-<decision-as-a-sentence>.md, …
│   └── agents/     # how skills use this repo (this file)
├── plans/          # implementation plans from /improve (not committed yet)
└── src/
    └── features/   # one folder per app: afl-tipping, hub, auth
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a
test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary
explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR 0001 (…), but worth reopening because…_
