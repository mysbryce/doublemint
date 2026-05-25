"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const vscode = require("vscode");

const LANGUAGE_ID = "doublemint";
const OUTPUT_CHANNEL_NAME = "Doublemint";

let diagnostics;
let output;
let pendingTimers = new Map();
let extensionRoot = "";

function activate(context) {
  extensionRoot = context.extensionPath;
  diagnostics = vscode.languages.createDiagnosticCollection("doublemint");
  output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);

  context.subscriptions.push(diagnostics, output);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      { provideCompletionItems },
      "."
    ),
    vscode.workspace.onDidOpenTextDocument(scheduleDiagnostics),
    vscode.workspace.onDidSaveTextDocument(runDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => scheduleDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("doublemint.diagnostics")) {
        runDiagnosticsForOpenDocuments();
      }
    })
  );

  runDiagnosticsForOpenDocuments();
}

function provideCompletionItems(document, position) {
  const text = document.getText();
  const model = buildCompletionModel(text);
  const fieldCompletions = completeFields(document, position, model);

  if (fieldCompletions) {
    return fieldCompletions;
  }

  return [
    ...keywordCompletions(),
    ...typeCompletions(model),
    ...symbolCompletions(model)
  ];
}

function deactivate() {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
}

function runDiagnosticsForOpenDocuments() {
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === LANGUAGE_ID) {
      scheduleDiagnostics(document);
    }
  }
}

function scheduleDiagnostics(document) {
  if (!shouldLint(document)) {
    return;
  }

  const config = vscode.workspace.getConfiguration("doublemint", document.uri);
  const debounceMs = config.get("diagnostics.debounceMs", 350);
  const key = document.uri.toString();
  const previous = pendingTimers.get(key);

  if (previous) {
    clearTimeout(previous);
  }

  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      runDiagnostics(document);
    }, debounceMs)
  );
}

function shouldLint(document) {
  if (!document || document.languageId !== LANGUAGE_ID || document.uri.scheme !== "file") {
    return false;
  }

  const config = vscode.workspace.getConfiguration("doublemint", document.uri);
  return config.get("diagnostics.enabled", true);
}

function runDiagnostics(document) {
  if (!shouldLint(document)) {
    diagnostics.delete(document.uri);
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(document.uri.fsPath);
  const command = resolveDiagnosticCommand(document.uri, cwd);

  runCheck(command, document.uri.fsPath, cwd, document.getText())
    .then((result) => {
      diagnostics.set(document.uri, parseDiagnostics(result.stderr || result.stdout, document));
      if (result.status !== 0 && !result.stderr && result.stdout) {
        output.appendLine(result.stdout);
      }
    })
    .catch((error) => {
      diagnostics.set(document.uri, [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Doublemint diagnostics failed: ${error.message}`,
          vscode.DiagnosticSeverity.Warning
        )
      ]);
      output.appendLine(String(error.stack || error.message || error));
    });
}

function resolveDiagnosticCommand(uri, cwd) {
  const config = vscode.workspace.getConfiguration("doublemint", uri);
  const custom = config.get("diagnostics.command", "").trim();

  if (custom) {
    return { command: custom, args: ["check"] };
  }

  const bundledCli = path.join(extensionRoot, "server", "dist", "cli.js");
  if (fs.existsSync(bundledCli)) {
    return { command: process.execPath, args: [bundledCli, "check"] };
  }

  const workspaceCli = path.join(cwd, "dist", "cli.js");
  if (fs.existsSync(workspaceCli)) {
    return { command: process.execPath, args: [workspaceCli, "check"] };
  }

  const binName = process.platform === "win32" ? "doublemint.cmd" : "doublemint";
  const localBin = path.join(cwd, "node_modules", ".bin", binName);
  if (fs.existsSync(localBin)) {
    return { command: localBin, args: ["check"] };
  }

  return { command: binName, args: ["check"] };
}

function runCheck(command, filepath, cwd, source) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, [...command.args, "--stdin-filepath", filepath], {
      cwd,
      shell: Boolean(vscode.workspace.getConfiguration("doublemint").get("diagnostics.command", "").trim()),
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
    child.stdin.end(source);
  });
}

function parseDiagnostics(raw, document) {
  if (!raw.trim()) {
    return [];
  }

  const lines = raw.split(/\r?\n/u);
  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = /^(ERROR|WARNING)\s+(DLM\d+):\s+(.+)$/u.exec(lines[index]);
    if (!header) {
      continue;
    }

    const locationLine = lines[index + 1] || "";
    const location = /^ --> (.*):(\d+):(\d+)$/u.exec(locationLine);

    if (location && !sameFile(location[1], document.uri.fsPath)) {
      continue;
    }

    const line = location ? Number(location[2]) - 1 : 0;
    const column = location ? Number(location[3]) - 1 : 0;
    const range = rangeFromDocument(document, line, column);
    const severity = header[1] === "ERROR"
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;
    const diagnostic = new vscode.Diagnostic(
      range,
      `${header[1]} ${header[2]}: ${header[3]}`,
      severity
    );

    diagnostic.code = header[2];
    diagnostic.source = "doublemint";
    parsed.push(diagnostic);
  }

  return parsed;
}

function completeFields(document, position, model) {
  const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
  const match = /([A-Za-z_][A-Za-z0-9_]*)\.$/u.exec(linePrefix);

  if (!match) {
    return null;
  }

  const variableName = match[1];
  const typeName = model.variables.get(variableName);
  const struct = typeName ? model.structs.get(typeName) : undefined;

  if (!struct) {
    return [];
  }

  return struct.map((field) => {
    const item = new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Field);
    item.detail = `${field.type} field`;
    item.insertText = field.name;
    return item;
  });
}

function keywordCompletions() {
  return [
    keyword("import"),
    keyword("import type"),
    keyword("export"),
    keyword("extern"),
    keyword("struct"),
    keyword("type"),
    keyword("function"),
    keyword("let"),
    keyword("const"),
    keyword("copy"),
    keyword("return"),
    keyword("if"),
    keyword("else"),
    keyword("while"),
    keyword("for"),
    keyword("switch"),
    keyword("case"),
    keyword("default"),
    keyword("as"),
    keyword("fn"),
    keyword("true"),
    keyword("false")
  ];
}

function typeCompletions(model) {
  const items = ["void", "int", "float", "double", "string", "bool"].map((name) => {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
    item.detail = "primitive type";
    return item;
  });

  for (const structName of model.structs.keys()) {
    const item = new vscode.CompletionItem(structName, vscode.CompletionItemKind.Struct);
    item.detail = "struct";
    items.push(item);
  }

  for (const typeName of model.typeAliases) {
    const item = new vscode.CompletionItem(typeName, vscode.CompletionItemKind.TypeParameter);
    item.detail = "type alias";
    items.push(item);
  }

  return items;
}

function symbolCompletions(model) {
  const items = [];

  const print = new vscode.CompletionItem("print", vscode.CompletionItemKind.Function);
  print.detail = "builtin function";
  print.insertText = new vscode.SnippetString("print(${1:value})");
  items.push(print);

  for (const fn of model.functions) {
    const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
    item.detail = fn.detail;
    item.insertText = new vscode.SnippetString(`${fn.name}(${fn.params.map((param, index) => `\${${index + 1}:${param}}`).join(", ")})`);
    items.push(item);
  }

  for (const [name, type] of model.variables) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    item.detail = type;
    items.push(item);
  }

  return items;
}

function keyword(label) {
  const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
  item.detail = "Doublemint keyword";
  return item;
}

function buildCompletionModel(source) {
  const clean = stripCommentsAndStrings(source);
  const structs = new Map();
  const variables = new Map();
  const functions = [];
  const typeAliases = new Set();

  for (const match of clean.matchAll(/\bstruct\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/gu)) {
    const fields = [];
    for (const field of match[2].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^;]+);/gu)) {
      fields.push({ name: field[1], type: field[2].trim() });
    }
    structs.set(match[1], fields);
  }

  for (const match of clean.matchAll(/\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/gu)) {
    typeAliases.add(match[1]);
  }

  for (const match of clean.matchAll(/\b(?:let|const)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=;\n]+)/gu)) {
    variables.set(match[1], match[2].trim());
  }

  for (const match of clean.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:\s*([^{;]+)/gu)) {
    const params = parseParams(match[2]);
    const returnType = match[3].trim();
    functions.push({
      name: match[1],
      params: params.map((param) => param.name),
      detail: `function(${params.map((param) => `${param.name}: ${param.type}`).join(", ")}): ${returnType}`
    });

    for (const param of params) {
      variables.set(param.name, param.type);
    }
  }

  return { structs, variables, functions, typeAliases };
}

function parseParams(raw) {
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/u.exec(part.trim()))
    .filter(Boolean)
    .map((match) => ({ name: match[1], type: match[2].trim() }));
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\/.*$/gmu, "")
    .replace(/"(?:\\.|[^"\\])*"/gu, "\"\"");
}

function sameFile(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function rangeFromDocument(document, line, column) {
  const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
  const textLine = document.lineAt(safeLine);
  const start = Math.max(0, Math.min(column, textLine.text.length));
  const end = Math.max(start + 1, firstTokenEnd(textLine.text, start));

  return new vscode.Range(safeLine, start, safeLine, Math.min(end, textLine.text.length));
}

function firstTokenEnd(text, start) {
  const match = /[A-Za-z0-9_]+/u.exec(text.slice(start));

  if (match && match.index === 0) {
    return start + match[0].length;
  }

  return start + 1;
}

module.exports = {
  activate,
  deactivate
};
