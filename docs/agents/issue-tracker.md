# Issue tracker: GitHub Issues

Issues and specs for this repo live in GitHub Issues on **`Parametricall/hot_shots`**.

- **Ticket references**: cite issues by number, e.g. `#42`. Link one as
  `https://github.com/Parametricall/hot_shots/issues/42` when the reader isn't on GitHub.
- **Commit trailers**: `AGENTS.md`'s commit convention puts the issue in a `Refs: #42` trailer
  (`Fixes: #42` when the commit should close it). Reuse that format everywhere a skill references
  an issue.

## When a skill says "publish to the issue tracker"

Draft the title, body and acceptance criteria, show them to the user, and file the issue only once
they agree:

```bash
gh issue create --repo Parametricall/hot_shots --title "…" --body-file <file>
```

## When a skill says "fetch the relevant ticket"

```bash
gh issue view 42 --repo Parametricall/hot_shots --comments
```

## Without the `gh` CLI

`gh` isn't always installed or signed in. If it fails, don't work around it: draft the issue for
the user to paste in, or ask them to paste the issue's details (title, description, acceptance
criteria, comments).
