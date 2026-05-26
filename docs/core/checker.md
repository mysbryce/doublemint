# Semantic checker

`src/semantic/checker.ts` validates the resolved module graph. Every
diagnostic in the `DLM4xxx` range comes from this layer.

## What it checks

- **Symbols and scopes** — declarations register on either the `types`
  or `values` side; references resolve through nested `Scope`s.
- **Types** — every expression has an inferred type; assignments,
  returns, function arguments, struct fields, and match arms are
  checked against expected types.
- **Imports** — every imported name resolves to an export on the source
  module side; type-only imports stay out of the value side.
- **Mutation** — `let` is mutable, `const` and parameters are not.
  Assignment targets must be mutable
  (`assertMutableAssignmentTarget`).
- **Generics** — free-function type parameters are unified at the call
  site via `collectGenericSubstitutions` /
  `applyGenericSubstitution`.
- **Pattern matching** — patterns must be assignable to the
  discriminant; expression-form `match` requires a wildcard arm.
- **Async / await** — `await` requires a `Future<T>` operand; async
  declarations register with a wrapped return type.
- **Method-style on primitives** — `name.upper()` resolves through
  `resolvePrimitiveExtension` by unifying the namespace function's
  first parameter with the receiver.

## Symbol kinds

| Kind | Source |
| --- | --- |
| `variable` | `let` / `const` / function parameter |
| `function` | named function declaration |
| `type` | `type` alias |
| `struct` | `struct` declaration |
| `enum` | `enum` declaration |
| `namespace` | `mint:*` namespace import |

## Diagnostic flow

```
parse error  → DLM2xxx (parser)
resolver     → DLM3xxx
checker      → DLM4xxx
emitter      → DLM5xxx
native       → DLM6xxx
```

The full list is in [Diagnostics](./diagnostics).

## Reading the checker

`checkModuleGraph(graph)`:

1. Builds a `ModuleEnvironment` per module — imports first, then
   declarations.
2. `validateTypeDeclarations` walks each type to make sure every
   referenced name is known.
3. `validateFunctionBodies` walks every function body, threading the
   declared return type through `validateStatement`.

Most user-facing diagnostics originate in `validateStatement` or
`inferExpressionType`. Both are heavy `switch` statements over the AST
union, so the TypeScript `assertNever` catches missing cases when you
add new node kinds.
