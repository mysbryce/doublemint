# Patch notes

While Doublemint is pre-1.0, every shipped feature gets a bump in the
form `0.0.1-dev-<n>`, where `<n>` is a monotonically increasing
counter. Once the planned phases are complete, the next bump rolls the
project to `0.0.1` proper.

## How to bump

```bash
pnpm version:bump "<title>"
```

The script will:

1. Read `package.json`'s current `0.0.1-dev-<n>` version.
2. Increment `<n>` in both the root `package.json` and
   `ext/doublemint-vscode/package.json`.
3. Drop a starter note at `patch-notes/0.0.1-dev-<n>.md`. Fill that in
   (Highlights / Files touched / Tests / examples) and commit
   together with the feature itself.

The commit message should read like:

```
chore(release): 0.0.1-dev-<n> — <title>
```

so the version, the change, and the patch note all land in the same
commit.

## Roadmap (target for `0.0.1` final)

- Phase 1 — language ergonomics (`&&`, `||`, ternary, string `+`,
  lambda block body, template literals)
- Phase 2 — stdlib widening (`mint:string`, `mint:array`, full
  `mint:math`, Base64, real crypto hashes)
- Phase 3 — network/data (HTTP client, WebSocket, SQLite, process
  pipes)
- Phase 4 — tooling (`mint:test`, `doublemint fmt`, REPL)
- Phase 5 — heavy (async/await, HTTPS, pattern matching, enums)

When everything above ships, the next bump becomes `0.0.1`.
