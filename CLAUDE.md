# CLAUDE.md — Doublemint contributor playbook

This file is the persistent set of rules for anyone (human or AI) working
on the Doublemint repository. Read it before touching code. Follow it
without exception.

## Project shape

- `src/` — the TypeScript transpiler (lexer / parser / resolver / checker /
  emitter / native-compiler / runtime helpers / builtins / cli / repl /
  formatter).
- `src/runtime/` — vendored C/C++ sources for `mint:*` modules
  (`headers/`, `sources/`, `vendor/`).
- `src/builtins/mintModules.ts` — single source of truth for every
  `mint:*` module signature; the VS Code extension manifest and the
  semantic checker both read from this.
- `tests/` — vitest. `unit/` for fast in-process tests, `integration/`
  for "build it, run it, assert stdout" tests, `emitter/`, `cli/` etc.
- `examples/` — end-to-end `.dlm` projects exercised by
  `pnpm build:examples`.
- `patch-notes/0.0.1-dev-N.md` — one note per shipped feature.
- `docs/` — VitePress site (this docs system). Public surface of the
  project.
- `PRODUCT_SPEC.md` — product direction and acceptance criteria.
- `README.md` — first impression; what someone sees on GitHub.

## Version line

The project is on `0.0.1-dev-N`. Every shipped feature increments `N`.
`N` lives in `package.json`, `ext/doublemint-vscode/package.json`, and
the `patch-notes/0.0.1-dev-N.md` filename. `scripts/bump-version.mjs`
keeps all three in sync — never bump by hand.

## Release discipline (HARD REQUIREMENT)

For **every** change that lands on `main` — new feature, patch, bug fix,
refactor, doc-only — the following checklist applies. Skip any step
and future debugging gets harder.

### 1. Bump the version (only for features / patches / fixes)

```bash
pnpm version:bump "<short title>"
```

This:

- Increments `dev-N` in `package.json` and
  `ext/doublemint-vscode/package.json`.
- Creates `patch-notes/0.0.1-dev-N.md` with a stub.

If the change is doc-only or repo-meta (CLAUDE.md, README, etc.), skip
the bump and commit directly — see "Doc-only changes" below.

### 2. Implement with at least one integration test

- Real features need a `tests/integration/<feature>Build.test.ts` that
  builds a `.dlm` snippet, runs the binary, and asserts on stdout. Use
  an existing integration test as a template.
- Bug fixes need a regression test that fails without the fix and passes
  with it.
- Internal refactors need either a unit test for the refactored seam or
  a clear note in the patch note saying why no new test was needed.

### 3. Run the full bar — green or block

```bash
pnpm test            # all vitest tests must pass
pnpm build:examples  # every example must still build
```

If either fails, fix it before continuing. Don't ship red.

### 4. Update the docs

Anything touching the public surface goes into `docs/` as part of the
same commit.

| Change | Update |
| --- | --- |
| New language syntax / keyword / operator | `docs/language/*.md` plus an updated tour in `docs/start/quickstart.md` if it's user-facing. |
| New builtin module or new method on an existing one | `docs/stdlib/<module>.md` and `docs/stdlib/overview.md` if the module list grew. |
| New / changed CLI command or flag | `docs/cli/*.md`. |
| Compiler internals (parser, checker, emitter, native pipeline) | `docs/core/*.md`. |
| New diagnostic code | `docs/core/diagnostics.md`. |

If the docs site doesn't change but the change is user-visible, the
patch note in `patch-notes/` carries the explanation instead — don't
leave it undocumented entirely.

### 5. Update the README

Touch `README.md` whenever:

- A new CLI command exists.
- The "Language Surface" or "mint:*" stdlib list changes.
- The Verification / Release Discipline workflow changes.
- The "Current Limits" list shrinks (we delivered something it claimed
  was missing).

Match the tone of the existing sections — short, factual, link into the
docs for depth.

### 6. Fill in the patch note

`patch-notes/0.0.1-dev-N.md` must have:

- **Highlights** — what the user can do now that they couldn't before.
  Code example preferred.
- **Files touched** — bullet list with one-sentence purpose per file.
- **Tests / examples** — `X / X tests pass`, `25 / 25 examples build`.
- **Up next** — what we're holding for the next bump.

The note is read by future-you to remember *why* something landed. Make
it useful.

### 7. Commit

```bash
git add -A
git commit -m "chore(release): 0.0.1-dev-N — <title>"
```

For doc-only or repo-meta changes use `docs:` or `chore:` prefixes
instead, but still commit immediately — don't let work-in-progress
files pile up between sessions.

## Doc-only changes

If a change is purely in `docs/`, `README.md`, `PRODUCT_SPEC.md`,
`CLAUDE.md`, or `patch-notes/`:

- No `version:bump`.
- No patch note.
- No integration test.
- Still run `pnpm docs:build` to confirm the site builds clean.
- Commit with `docs: <one-line summary>` or `chore: <…>`.

## Bug fixes

A bug fix **does** count as a bump. Treat it like any other feature
release:

1. `pnpm version:bump "fix <subject>"`
2. Write a regression test that fails before the fix.
3. Land the fix; rerun `pnpm test` and `pnpm build:examples`.
4. Update docs if the bug exposed a documentation gap (often yes — that's
   why the bug shipped).
5. Patch note: Highlights = "what surprised the user", Files touched =
   the fix sites, Tests = the new regression test.
6. Commit as `fix(release): 0.0.1-dev-N — <subject>`.

## Compiler change checklist

When touching the compiler core (`src/lexer/`, `src/parser/`,
`src/semantic/`, `src/emitter/`, `src/resolver/`,
`src/core/nativeCompiler.ts`), also remember:

- New AST node? Update **every** walker in
  `src/emitter/cppEmitter.ts` —
  `collectStringViewDeclarations`, `collectAssignedRoots`,
  `collectAssignedRootsFromExpression`, `statementUsesPrint`,
  `expressionUsesPrint`, `statementUsesDefer`. The TS compiler will
  catch most of these via `assertNever`, but the integration tests will
  catch the runtime fallout.
- New keyword? Add to the lexer keyword map AND the syntax-highlight
  TextMate grammar at `ext/doublemint-vscode/syntaxes/`.
- New builtin module / method? Update
  `src/builtins/mintModules.ts` *and* refresh the VS Code extension
  manifest (`pnpm manifest:refresh`, runs automatically as part of
  `pnpm build`).

## Stdlib change checklist

When adding to `mint:*`:

- Add the namespace / class / member to `src/builtins/mintModules.ts`
  with native names that match the C++ implementation.
- Add the C++ implementation under `src/runtime/sources/<module>.cpp`
  (plus header in `src/runtime/headers/` for class types).
- Wire the source module into `RUNTIME_SOURCE_MODULES` and the source
  map in `src/emitter/cppEmitter.ts` so the emitter pulls it in for
  programs that import the module.
- Add an integration test under
  `tests/integration/mint<Module>Build.test.ts` that builds a snippet
  using the new surface and asserts on stdout.
- Update `docs/stdlib/<module>.md`.

## Commit hygiene

- One conceptual change per commit. If a bump touches the parser and
  also fixes an unrelated docs typo, split them.
- Never amend a commit you've already pushed.
- Never `git reset --hard` shared branches.
- Hooks (`pre-commit`, `pre-push`) run real checks. Don't pass
  `--no-verify`.

## When something blocks you

- Compilation fails on Windows MinGW with a silent `collect2` exit-5 →
  it's the `COMPILER_PATH` / `LIBRARY_PATH` env-vars bug. The build
  pipeline already auto-falls-back; if you bypass it, sanitize the env
  yourself.
- A vitest test only fails when run in parallel with others (often
  `multiFileBuild`) → it's the well-known g++ contention flake. Re-run
  the single file in isolation; if green, it's the flake, not your
  change.
- TypeScript `assertNever` complains about a missing case → you added an
  AST node and forgot to handle it somewhere. Open
  `src/emitter/cppEmitter.ts` and `src/semantic/checker.ts` and walk
  every `switch (… .type)` on that union.

## Branching

The primary branch is `main`. Feature work happens directly on `main`
through small, well-described commits — there's no PR ceremony in this
repo. If you need a longer-running branch, name it after the feature
(`feat/match-bindings`) and rebase onto `main` before merging.
