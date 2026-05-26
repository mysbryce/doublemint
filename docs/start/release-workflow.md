# Release workflow

Doublemint ships one feature per bump. The version line is
`0.0.1-dev-N` — every `N` corresponds to one shipped feature plus its
patch note. This page is the short version of what's in
[`CLAUDE.md`](https://github.com/mysbryce/doublemint/blob/main/CLAUDE.md);
read that file for the exhaustive rules.

## The five-step loop

```bash
# 1. Bump
pnpm version:bump "<short title>"

# 2. Implement + add an integration test

# 3. Run the full bar
pnpm test
pnpm build:examples

# 4. Update docs/, README.md, fill in
#    patch-notes/0.0.1-dev-N.md

# 5. Commit
git add -A
git commit -m "chore(release): 0.0.1-dev-N — <title>"
```

## When does a change need a bump?

| Change | Bump? |
| --- | --- |
| New language syntax / operator / keyword | **Yes** |
| New stdlib module or method | **Yes** |
| New CLI command or flag | **Yes** |
| Compiler bug fix | **Yes** |
| Refactor with behaviour change | **Yes** |
| Internal cleanup with no behaviour change | No — `chore:` commit |
| `docs/`, `README.md`, `PRODUCT_SPEC.md`, `CLAUDE.md` | No — `docs:` commit |
| Test-only fix | No — `chore:` commit |

## What goes into the patch note?

`patch-notes/0.0.1-dev-N.md` must have:

- **Highlights** — what the user can do now that they couldn't before
  (code example preferred).
- **Files touched** — bullets with a one-sentence purpose per file.
- **Tests / examples** — `X / X tests pass`, `25 / 25 examples build`.
- **Up next** — what we're holding for the next bump.

Future-you reads these to remember *why* a change landed. Make them
useful.

## Why this matters

The codebase grows in well-described slices, so when something
regresses in `dev-37` you can `git log --oneline patch-notes/` to find
the bump that introduced the surface, read its patch note, and start
debugging from a known state. Skipping docs / README / patch note
breaks that workflow.
