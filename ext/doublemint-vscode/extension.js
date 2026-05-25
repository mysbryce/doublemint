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
let builtinManifest = { modules: {} };

function activate(context) {
  extensionRoot = context.extensionPath;
  diagnostics = vscode.languages.createDiagnosticCollection("doublemint");
  output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  builtinManifest = loadBuiltinManifest(extensionRoot);

  context.subscriptions.push(diagnostics, output);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      { provideCompletionItems },
      ".",
      "{",
      ",",
      " ",
      "\""
    ),
    vscode.languages.registerHoverProvider(LANGUAGE_ID, { provideHover }),
    vscode.languages.registerDefinitionProvider(LANGUAGE_ID, { provideDefinition }),
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

  const importBraceCompletions = completeImportBrace(document, position);
  if (importBraceCompletions) {
    return importBraceCompletions;
  }

  const importSourceCompletions = completeImportSource(document, position);
  if (importSourceCompletions) {
    return importSourceCompletions;
  }

  const model = buildCompletionModel(text);
  const builtinImports = collectBuiltinImports(text, builtinManifest);
  const memberCompletions = completeBuiltinMember(document, position, builtinImports);

  if (memberCompletions) {
    return memberCompletions;
  }

  const fieldCompletions = completeFields(document, position, model);

  if (fieldCompletions) {
    return fieldCompletions;
  }

  return [
    ...keywordCompletions(),
    ...typeCompletions(model),
    ...symbolCompletions(model),
    ...builtinSymbolCompletions(builtinImports)
  ];
}

function completeImportBrace(document, position) {
  const lineText = document.lineAt(position.line).text;
  const before = lineText.slice(0, position.character);
  const after = lineText.slice(position.character);

  const braceMatch = /\bimport(?:\s+type)?\s*\{([^}]*)$/u.exec(before);
  if (!braceMatch) {
    return null;
  }

  const tailMatch = /^([^}]*)\}\s*from\s*"([^"]+)"/u.exec(after);
  if (!tailMatch) {
    return null;
  }

  const source = tailMatch[2];
  const moduleEntry = builtinManifest.modules[source];
  if (!moduleEntry) {
    return null;
  }

  const alreadyImported = new Set(
    `${braceMatch[1]},${tailMatch[1]}`
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );

  return moduleEntry.exports
    .filter((entry) => !alreadyImported.has(entry.name))
    .map((entry) => {
      const kind = entry.kind === "function"
        ? vscode.CompletionItemKind.Function
        : entry.kind === "class"
          ? vscode.CompletionItemKind.Class
          : vscode.CompletionItemKind.Module;
      const item = new vscode.CompletionItem(entry.name, kind);
      item.detail = `${entry.kind} from ${source}`;
      item.insertText = entry.name;
      if (entry.kind === "function") {
        item.documentation = `(${(entry.params || []).join(", ")}) -> ${entry.returnType || "void"}`;
      } else if (entry.members) {
        item.documentation = `Members: ${entry.members.map((m) => m.name).join(", ")}`;
      }
      return item;
    });
}

function completeImportSource(document, position) {
  const lineText = document.lineAt(position.line).text;
  const before = lineText.slice(0, position.character);

  const sourceMatch = /\bimport(?:\s+type)?\s*\{[^}]*\}\s*from\s*"([^"]*)$/u.exec(before);
  if (!sourceMatch) {
    return null;
  }

  return Object.keys(builtinManifest.modules).map((source) => {
    const item = new vscode.CompletionItem(source, vscode.CompletionItemKind.Module);
    item.detail = "Doublemint builtin module";
    const moduleEntry = builtinManifest.modules[source];
    item.documentation = `Exports: ${moduleEntry.exports.map((entry) => entry.name).join(", ")}`;
    item.insertText = source;
    return item;
  });
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
    keyword("defer"),
    keyword("as"),
    keyword("fn"),
    keyword("true"),
    keyword("false"),
    keyword("null")
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

function provideHover(document, position) {
  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/u);
  if (!wordRange) {
    return null;
  }

  const word = document.getText(wordRange);
  const text = document.getText();
  const builtinImports = collectBuiltinImports(text, builtinManifest);
  const lineText = document.lineAt(position.line).text;
  const before = lineText.slice(0, wordRange.start.character);
  const memberMatch = /([A-Za-z_][A-Za-z0-9_]*)\.$/u.exec(before);

  if (memberMatch) {
    const owner = builtinImports.get(memberMatch[1]);
    if (owner && owner.members) {
      const member = owner.members.find((entry) => entry.name === word);
      if (member) {
        return new vscode.Hover(renderMember(owner, member), wordRange);
      }
    }
  }

  const direct = builtinImports.get(word);
  if (direct) {
    return new vscode.Hover(renderExport(direct), wordRange);
  }

  const userSymbols = collectUserSymbols(document);
  const userSymbol = userSymbols.get(word);
  if (userSymbol) {
    return new vscode.Hover(renderUserSymbol(userSymbol, document.uri.fsPath), wordRange);
  }

  return null;
}

function provideDefinition(document, position) {
  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/u);
  if (!wordRange) {
    return null;
  }

  const word = document.getText(wordRange);
  const userSymbols = collectUserSymbols(document);
  const symbol = userSymbols.get(word);
  if (!symbol || !symbol.location) {
    return null;
  }

  const uri = vscode.Uri.file(symbol.location.filepath);
  const pos = new vscode.Position(symbol.location.line, symbol.location.character);
  return new vscode.Location(uri, pos);
}

function renderUserSymbol(symbol, currentFilepath) {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(symbol.signature, "doublemint");
  if (symbol.location) {
    const sameFileFlag = sameFile(symbol.location.filepath, currentFilepath);
    const origin = sameFileFlag
      ? `line ${symbol.location.line + 1}`
      : `${path.basename(symbol.location.filepath)}:${symbol.location.line + 1}`;
    md.appendMarkdown(`\n_${symbol.kind}${sameFileFlag ? "" : " (imported)"} • ${origin}_`);
  } else {
    md.appendMarkdown(`\n_${symbol.kind}_`);
  }
  return md;
}

function renderExport(entry) {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(formatExportSignature(entry), "doublemint");
  md.appendMarkdown(`\n_${entry.kind} from \`${entry.source}\`_`);
  if (entry.members && entry.members.length > 0) {
    md.appendMarkdown(`\n\n**Members:** ${entry.members.map((m) => `\`${m.name}\``).join(", ")}`);
  }
  return md;
}

function renderMember(owner, member) {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(formatMemberSignature(owner.name, member), "doublemint");
  md.appendMarkdown(`\n_${member.kind} of ${owner.kind} \`${owner.name}\` (\`${owner.source}\`)_`);
  return md;
}

function formatExportSignature(entry) {
  if (entry.kind === "function") {
    const params = entry.params || [];
    return `function ${entry.name}(${params.join(", ")}): ${entry.returnType || "void"}`;
  }
  if (entry.kind === "namespace") {
    return `namespace ${entry.name}`;
  }
  if (entry.kind === "class") {
    return `class ${entry.name}`;
  }
  return `${entry.kind} ${entry.name}`;
}

function formatMemberSignature(ownerName, member) {
  if (member.kind === "function") {
    const params = member.params || [];
    return `${ownerName}.${member.name}(${params.join(", ")}): ${member.returnType || "void"}`;
  }
  return `${ownerName}.${member.name}: ${member.valueType || "value"}`;
}

function collectUserSymbols(document) {
  const seen = new Set();
  const symbols = new Map();
  const baseDir = path.dirname(document.uri.fsPath);

  indexFile(document.uri.fsPath, document.getText(), symbols, seen);

  const importRegex = /\bimport(?:\s+type)?\s*\{([^}]*)\}\s*from\s*"([^"]+)"\s*;/gu;
  for (const match of document.getText().matchAll(importRegex)) {
    const source = match[2];
    if (source.startsWith("mint:")) {
      continue;
    }
    const resolved = resolveImportPath(baseDir, source);
    if (!resolved || seen.has(resolved.toLowerCase())) {
      continue;
    }
    try {
      const text = fs.readFileSync(resolved, "utf8");
      indexFile(resolved, text, symbols, seen);
    } catch {
      // ignore missing imports
    }
  }

  return symbols;
}

function resolveImportPath(baseDir, source) {
  const candidates = [];
  if (source.endsWith(".dlm")) {
    candidates.push(path.resolve(baseDir, source));
  } else {
    candidates.push(path.resolve(baseDir, `${source}.dlm`));
    candidates.push(path.resolve(baseDir, source, "main.dlm"));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function indexFile(filepath, source, symbols, seen) {
  const key = filepath.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  seen.add(key);

  const clean = stripPreservingOffsets(source);
  const lineStarts = computeLineStarts(source);

  const functionRegex = /\b(export\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:\s*([^{;]+)/gu;
  for (const match of clean.matchAll(functionRegex)) {
    const nameIndex = match.index + match[0].indexOf(match[2]);
    const params = parseParams(match[3]);
    const returnType = match[4].trim();
    const signature = `function ${match[2]}(${params
      .map((param) => `${param.name}: ${param.type}`)
      .join(", ")}): ${returnType}`;
    upsert(symbols, match[2], {
      name: match[2],
      kind: "function",
      signature,
      params,
      returnType,
      location: locationAt(filepath, lineStarts, nameIndex)
    });
  }

  const structRegex = /\b(export\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/gu;
  for (const match of clean.matchAll(structRegex)) {
    const nameIndex = match.index + match[0].indexOf(match[2]);
    const fields = [];
    for (const field of match[3].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^;]+);/gu)) {
      fields.push({ name: field[1], type: field[2].trim() });
    }
    const signature = `struct ${match[2]} { ${fields
      .map((field) => `${field.name}: ${field.type}`)
      .join("; ")} }`;
    upsert(symbols, match[2], {
      name: match[2],
      kind: "struct",
      signature,
      fields,
      location: locationAt(filepath, lineStarts, nameIndex)
    });
  }

  const aliasRegex = /\b(export\s+)?type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/gu;
  for (const match of clean.matchAll(aliasRegex)) {
    const nameIndex = match.index + match[0].indexOf(match[2]);
    upsert(symbols, match[2], {
      name: match[2],
      kind: "type alias",
      signature: `type ${match[2]} = ${match[3].trim()}`,
      location: locationAt(filepath, lineStarts, nameIndex)
    });
  }
}

function upsert(map, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
}

function locationAt(filepath, lineStarts, offset) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineStarts[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { filepath, line: lo, character: offset - lineStarts[lo] };
}

function computeLineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function stripPreservingOffsets(source) {
  return source
    .replace(/\/\/.*$/gmu, (match) => " ".repeat(match.length))
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/"(?:\\.|[^"\\])*"/gu, (match) =>
      match.length <= 2 ? match : `"${" ".repeat(match.length - 2)}"`
    );
}

function loadBuiltinManifest(root) {
  const manifestPath = path.join(root, "builtin-manifest.json");
  try {
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    }
  } catch (error) {
    if (output) {
      output.appendLine(`Failed to load builtin manifest: ${error.message}`);
    }
  }
  return { modules: {} };
}

function collectBuiltinImports(source, manifest) {
  const map = new Map();
  const importRegex = /\bimport(?:\s+type)?\s*\{([^}]*)\}\s*from\s*"(mint:[A-Za-z0-9_]+)"\s*;/gu;
  for (const match of source.matchAll(importRegex)) {
    const names = match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const moduleEntry = manifest.modules[match[2]];
    if (!moduleEntry) {
      continue;
    }
    for (const name of names) {
      const exportEntry = moduleEntry.exports.find((entry) => entry.name === name);
      if (exportEntry) {
        map.set(name, { ...exportEntry, source: match[2] });
      }
    }
  }
  return map;
}

function completeBuiltinMember(document, position, builtinImports) {
  const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
  const match = /([A-Za-z_][A-Za-z0-9_]*)\.$/u.exec(linePrefix);
  if (!match) {
    return null;
  }

  const entry = builtinImports.get(match[1]);
  if (!entry || !entry.members) {
    return null;
  }

  return entry.members.map((member) => {
    const kind = member.kind === "function"
      ? vscode.CompletionItemKind.Method
      : vscode.CompletionItemKind.Field;
    const item = new vscode.CompletionItem(member.name, kind);
    if (member.kind === "function") {
      const params = member.params || [];
      const snippet = params.map((type, index) => `\${${index + 1}:${type}}`).join(", ");
      item.insertText = new vscode.SnippetString(`${member.name}(${snippet})`);
      item.detail = `(${params.join(", ")}) -> ${member.returnType || "void"}`;
    } else {
      item.insertText = member.name;
      item.detail = member.valueType || "value";
    }
    item.documentation = `${entry.name} from ${entry.source}`;
    return item;
  });
}

function builtinSymbolCompletions(builtinImports) {
  const items = [];
  for (const [name, entry] of builtinImports) {
    if (entry.kind === "function") {
      const params = entry.params || [];
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      const snippet = params.map((type, index) => `\${${index + 1}:${type}}`).join(", ");
      item.insertText = new vscode.SnippetString(`${name}(${snippet})`);
      item.detail = `builtin from ${entry.source}`;
      item.documentation = `(${params.join(", ")}) -> ${entry.returnType || "void"}`;
      items.push(item);
      continue;
    }

    const kind = entry.kind === "class"
      ? vscode.CompletionItemKind.Class
      : vscode.CompletionItemKind.Module;
    const item = new vscode.CompletionItem(name, kind);
    item.detail = `builtin ${entry.kind} from ${entry.source}`;
    items.push(item);
  }
  return items;
}

module.exports = {
  activate,
  deactivate
};
