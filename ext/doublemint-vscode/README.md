# Doublemint for VS Code

Syntax highlighting and realtime diagnostics for `.dlm` files.

## Features

- Highlights Doublemint declarations, statements, types, literals, comments, and operators.
- Provides completions for keywords, primitive types, structs, type aliases, functions, locals, parameters, and struct fields after `.`.
- Runs `doublemint check --stdin-filepath` and reports parser/resolver/semantic errors as VS Code diagnostics.
- Shows red/yellow squiggles in the editor, Problems panel entries, and hover messages such as `ERROR DLM2032: ...`.
- Associates `.dlm` files with the `doublemint` language id.
- Adds bracket pairing, comment toggling, and auto-closing pairs.

## Diagnostics

Diagnostics run against the current editor buffer after a short debounce.
Relative imports still resolve from the open file's real path. By default the
extension looks for:

1. bundled `server/dist/cli.js` inside the extension
2. `<workspace>/dist/cli.js`
3. `<workspace>/node_modules/.bin/doublemint`
4. `doublemint` from `PATH`

Override this with `doublemint.diagnostics.command`.

## Completion

Completion is local and realtime. It scans the open file for declarations and
uses explicit types to complete struct fields:

```typescript
let profile: Profile = Profile { id: 1, name: "mint", level: 3 };
profile.
```

After `profile.`, the editor suggests fields from `Profile`.

## Development

Open this folder in VS Code and press `F5` to launch an Extension Development Host.

## Packaging

Build the compiler first, then package the extension:

```bash
pnpm pack:vsix
```

The `vscode:prepublish` script copies the compiled Doublemint CLI into
`server/dist`, so the installed VSIX works without user PATH setup.
