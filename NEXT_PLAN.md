# Doublemint — Next Plan

_Starting point: `0.0.1-dev-40` (2026-05-27). 203 / 203 tests, 25 / 25 examples building, docs caught up._

Phase 5 closed out the **small + medium tier** of the post-bootstrap roadmap. What ships next is Phase 6 — the bigger bricks that unlock new categories of code rather than smoothing existing ones. The order below reflects rough cost / risk; ship top-down unless a dependent slips.

## Phase 6 — major features

### 1. Sum-type story (3–4 brick)

The most leveraged bucket. Everything else (Result, error propagation, real pattern matching) blocks on enum payload variants.

| Brick | What | Notes |
| --- | --- | --- |
| dev-41 | **Enum payload variants** | `enum Shape { Circle(float), Rect(float, float) }`. Lowers to `std::variant`. Touches lexer (parens after variant), parser (`EnumVariant.payload`), checker (payload arity + types), emitter (variant + helpers + visit), every walker. |
| dev-42 | **Pattern bindings in `match`** | `match s { Circle(r) => …, Rect(w, h) => … }`. Builds on dev-41. Requires checker to introduce bindings into the arm scope and emitter to lower to `std::visit` with structured-binding lambdas. |
| dev-43 | **`Result<T, E>` + builtin `Ok` / `Err`** | Convenience sum living in the prelude. Emit map to `std::variant<T, E>` with helper free functions. Integration: parsers/sql/json move to `Result` returns gradually. |
| dev-44 | **Error-propagation operator (`expr?`)** | Sugar over `Result` / `Optional`: short-circuits the enclosing function when the inner value is the error / none case. Parser adds postfix `?`, checker enforces return-type compatibility, emitter lowers to a small `if` + early return. |

Exit criteria for the bucket: every `mint:*` module that currently returns sentinel ints or throws now has a `Result`-returning variant in its surface.

### 2. Classes & methods (3 brick)

Once sum types land, OOP is the next biggest unlock for users.

| Brick | What |
| --- | --- |
| dev-45 | **`class` declaration + methods + fields + visibility** (`public` / `private`) with `this.` access; no inheritance yet. Lowers to a C++ `class` with `private:` / `public:` blocks. |
| dev-46 | **Constructors + member init**. `new ClassName(args)` resolves to the constructor; field defaults supported. |
| dev-47 | **Virtual dispatch / inheritance** (`class B : A`, `override`, `abstract` methods). Lowers to `class B : public A` with `virtual` / `override`. |

### 3. Generic data types (2 brick)

Generic free functions exist today; generic structs and classes are the natural extension.

| Brick | What |
| --- | --- |
| dev-48 | **Generic structs** — `struct Box<T> { value: T; }`. Already partly modelled in the checker; emitter needs to walk a template parameter list. |
| dev-49 | **Generic classes** — same surface for `class`. Includes member-function templates. |

### 4. HTTPS via OpenSSL (2 brick)

The remaining big runtime gap.

| Brick | What |
| --- | --- |
| dev-50 | **Vendor OpenSSL sources** into `src/runtime/vendor/openssl/`, wire build flags, expose `Http.useTls(certPath, keyPath)` on the server side. |
| dev-51 | **Client TLS for `Fetch`** + outbound WebSockets, certificate validation, optional pinning. |

### 5. LSP server (2 brick)

The `doublemint check --json` surface is already the foundation. Turning it into a real Language Server unlocks proper editor integrations (Neovim, JetBrains, etc.) beyond the bundled VS Code extension.

| Brick | What |
| --- | --- |
| dev-52 | **LSP scaffold** — `doublemint lsp` subcommand, JSON-RPC over stdio, document sync, diagnostics push. |
| dev-53 | **Hover / completion / goto-def** — reuse the resolver + checker results that the existing extension already calls into. |

## Smaller bricks held in reserve

When momentum on the big buckets stalls, these are short tactical wins.

- **`mint:fmt` extensions** — `Fmt.engineering`, `Fmt.duration`, `Fmt.bytes`.
- **String interpolation `=` flag** — `${name=}` → `name=value` like Python f-strings.
- **`@[attribute]` decorators** on free functions, parsed and emitted as attribute comments first, semantics later.
- **`mint:fs` watching** — recursive file watcher (libuv already vendored).
- **`mint:test` parallel runner** — opt-in `--parallel` flag.
- **Better REPL** — multi-line prompt, history, `:load`, `:reset`.
- **Examples** — port one realistic app (chat server / static blog / cli tool) end-to-end as a flagship demo.

## Process

Same release discipline as Phase 5: bump → impl + at least one integration test → green `pnpm test` + `pnpm build:examples` → docs + README touched in the same commit → patch note → `chore(release): 0.0.1-dev-N — <title>`. The contributor playbook in `CLAUDE.md` is the authoritative reference.

## Out of scope (deferred again)

- Package registry + version pinning.
- CMake project generation.
- Arena / GC allocator strategy.
- Trait / interface abstraction layer (revisit after classes settle).
- Cross-module enum discriminated unions (the dev-41 design should anticipate this but the cross-module work is its own brick).
