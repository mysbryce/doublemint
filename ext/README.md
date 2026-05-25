# Doublemint Editor Extensions

This folder contains editor integration packages for Doublemint.

## VS Code Extension

The VS Code extension lives in `doublemint-vscode`.
It provides TextMate syntax highlighting, autocomplete, and realtime diagnostics
through `doublemint check --stdin-filepath`.

Development path:

1. Open `ext/doublemint-vscode` in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Open a `.dlm` file.

Packaged install path:

```bash
pnpm pack:vsix
code --install-extension build/doublemint-vscode-0.1.0.vsix
```

The VSIX bundles the compiled Doublemint CLI, so diagnostics work after install
without setting PATH.
