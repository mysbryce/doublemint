# Releases

Doublemint ships one feature per bump. Each bump increments `dev-N` in
`0.0.1-dev-N` and is documented in a patch note under
[`patch-notes/`](https://github.com/mysbryce/doublemint/tree/main/patch-notes).

## Latest

- **0.0.1-dev-31** — compound `<<=` / `>>=`
- **0.0.1-dev-30** — shift `<<` / `>>`
- **0.0.1-dev-29** — compound `%= &= |= ^=`
- **0.0.1-dev-28** — bitwise `& | ^ ~`
- **0.0.1-dev-27** — modulo `%`
- **0.0.1-dev-26** — `bool.toString()`
- **0.0.1-dev-25** — `async function` and `await`
- **0.0.1-dev-24** — numeric `.toString()`
- **0.0.1-dev-23** — prefix `++` / `--`
- **0.0.1-dev-22** — postfix `++` / `--`
- **0.0.1-dev-21** — compound assignment `+= -= *= /=`
- **0.0.1-dev-20** — unary `-` and `!`
- **0.0.1-dev-19** — match expressions
- **0.0.1-dev-18** — match statements
- **0.0.1-dev-17** — enum declarations

## Phase 4 — tooling

- **0.0.1-dev-16** — `doublemint repl`
- **0.0.1-dev-15** — `doublemint fmt`
- **0.0.1-dev-14** — `doublemint init`
- **0.0.1-dev-13** — `doublemint info`
- **0.0.1-dev-12** — `doublemint version`
- **0.0.1-dev-11** — `mint:test`

## Phase 3 — stdlib widening

- **0.0.1-dev-10**…**dev-1** — core mint runtime libraries, generic calls
  + `new`, math + io builtins, optional / union types, native interop
  syntax.

The full text of every note is in
[`patch-notes/`](https://github.com/mysbryce/doublemint/tree/main/patch-notes)
and links from each release entry on GitHub.

## Release discipline

1. `pnpm version:bump "<title>"` bumps `dev-N` and stubs a patch note.
2. Implement the feature with at least one integration test.
3. `pnpm test` + `pnpm build:examples` must pass.
4. Fill in the patch note (Highlights / Files touched / Tests / examples /
   Up next).
5. Commit as `chore(release): 0.0.1-dev-N — <title>`.

## Roadmap

Near-term:

- `Async.run(fn)` — wrap a closure into a `Future<T>` without declaring
  an async function.
- `mint:fmt` — richer numeric formatting (precision, hex, padding).
- HTTPS via vendored OpenSSL.

Deferred (will land when the surface stabilises):

- Classes with methods, traits, virtual dispatch.
- Generic structs / classes (currently only generic free functions).
- Package registry + version pinning.
- CMake project generation.
