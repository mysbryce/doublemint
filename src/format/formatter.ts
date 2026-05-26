export interface FormatResult {
  output: string;
  changed: boolean;
}

export function formatSource(source: string): FormatResult {
  const normalized = source.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  const trimmed = lines.map((line) => line.replace(/[ \t]+$/u, ""));

  const collapsed: string[] = [];
  let pendingBlanks = 0;
  for (const line of trimmed) {
    if (line === "") {
      pendingBlanks += 1;
      continue;
    }
    if (collapsed.length > 0 && pendingBlanks > 0) {
      collapsed.push("");
    }
    pendingBlanks = 0;
    collapsed.push(line);
  }

  let output = collapsed.join("\n");
  if (output.length > 0 && !output.endsWith("\n")) {
    output += "\n";
  }

  return { output, changed: output !== source };
}
