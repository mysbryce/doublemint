import type { SourceLocation } from "../lexer/token.js";
import type { Program, TypeNode } from "../parser/ast.js";
import type {
  BuiltinClassMethod,
  BuiltinNamespaceMember,
  ModuleExport,
  ResolvedModule
} from "../resolver/moduleGraph.js";

const builtinLocation: SourceLocation = {
  filepath: "<builtin>",
  line: 1,
  column: 1,
  offset: 0,
  sourceLine: ""
};

const emptyProgram = (filepath: string): Program => ({
  type: "Program",
  sourceFile: filepath,
  body: []
});

const namedType = (name: string): TypeNode => ({
  type: "NamedType",
  name,
  location: builtinLocation
});

const arrayType = (elementType: TypeNode): TypeNode => ({
  type: "ArrayType",
  elementType,
  location: builtinLocation
});

const namespaceExport = (
  name: string,
  members: BuiltinNamespaceMember[]
): ModuleExport => ({
  name,
  kind: "value",
  builtin: true,
  namespaceMembers: new Map(members.map((member) => [member.name, member])),
  location: builtinLocation
});

const functionMember = (
  name: string,
  params: TypeNode[],
  returnType: TypeNode,
  nativeName: string
): BuiltinNamespaceMember => ({
  name,
  kind: "function",
  params,
  returnType,
  nativeName,
  location: builtinLocation
});

const valueMember = (
  name: string,
  valueType: TypeNode,
  nativeName: string
): BuiltinNamespaceMember => ({
  name,
  kind: "value",
  valueType,
  nativeName,
  location: builtinLocation
});

const topLevelFunctionExport = (
  name: string,
  params: TypeNode[],
  returnType: TypeNode,
  nativeName: string
): ModuleExport => ({
  name,
  kind: "value",
  builtin: true,
  functionType: { params, returnType },
  nativeName,
  location: builtinLocation
});

const classExport = (name: string, methods: BuiltinClassMethod[] = []): ModuleExport => ({
  name,
  kind: "value",
  builtin: true,
  classMethods: new Map(methods.map((method) => [method.name, method])),
  location: builtinLocation
});

const method = (
  name: string,
  params: TypeNode[],
  returnType: TypeNode
): BuiltinClassMethod => ({
  name,
  params,
  returnType,
  location: builtinLocation
});

const builtinModules = new Map<string, Omit<ResolvedModule, "filepath">>([
  [
    "mint:fs",
    {
      builtin: true,
      builtinIncludes: ["<filesystem>", "<fstream>", "<iterator>", "<string>", "<vector>"],
      program: emptyProgram("mint:fs"),
      imports: [],
      exports: new Map([
        [
          "File",
          namespaceExport("File", [
            functionMember("exists", [namedType("string")], namedType("bool"), "std::filesystem::exists"),
            functionMember("readToString", [namedType("string")], namedType("string"), "__doublemint_file_read_to_string"),
            functionMember("readToBytes", [namedType("string")], arrayType(namedType("int")), "__doublemint_file_read_to_bytes"),
            functionMember("writeString", [namedType("string"), namedType("string")], namedType("void"), "__doublemint_file_write_string"),
            functionMember("appendString", [namedType("string"), namedType("string")], namedType("void"), "__doublemint_file_append_string")
          ])
        ],
        [
          "Path",
          namespaceExport("Path", [
            functionMember("join", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_path_join"),
            functionMember("basename", [namedType("string")], namedType("string"), "__doublemint_path_basename")
          ])
        ]
      ])
    }
  ],
  [
    "mint:math",
    {
      builtin: true,
      builtinIncludes: ["<cmath>", "<numbers>"],
      program: emptyProgram("mint:math"),
      imports: [],
      exports: new Map([
        [
          "Math",
          namespaceExport("Math", [
            valueMember("PI", namedType("double"), "std::numbers::pi"),
            functionMember("sin", [namedType("double")], namedType("double"), "std::sin"),
            functionMember("sqrt", [namedType("double")], namedType("double"), "std::sqrt"),
            functionMember(
              "pow",
              [namedType("double"), namedType("double")],
              namedType("double"),
              "std::pow"
            ),
            functionMember(
              "roundToInt",
              [namedType("double")],
              namedType("int"),
              "std::lround"
            )
          ])
        ]
      ])
    }
  ],
  [
    "mint:time",
    {
      builtin: true,
      builtinIncludes: ["<chrono>", "<string>", "<unordered_map>"],
      program: emptyProgram("mint:time"),
      imports: [],
      exports: new Map([
        [
          "Time",
          namespaceExport("Time", [
            functionMember("nowInMs", [], namedType("int"), "__doublemint_now_ms")
          ])
        ],
        [
          "Profiler",
          namespaceExport("Profiler", [
            functionMember("start", [namedType("string")], namedType("void"), "__doublemint_profiler_start"),
            functionMember("stop", [namedType("string")], namedType("int"), "__doublemint_profiler_stop")
          ])
        ]
      ])
    }
  ],
  [
    "mint:collections",
    {
      builtin: true,
      builtinIncludes: ["<queue>", "<stack>", "<stdexcept>", "<unordered_set>"],
      program: emptyProgram("mint:collections"),
      imports: [],
      exports: new Map([
        ["Queue", classExport("Queue", [method("push", [namedType("T")], namedType("void")), method("pop", [], namedType("T")), method("empty", [], namedType("bool")), method("size", [], namedType("int"))])],
        ["Set", classExport("Set", [method("add", [namedType("T")], namedType("void")), method("has", [namedType("T")], namedType("bool")), method("size", [], namedType("int"))])],
        ["Stack", classExport("Stack", [method("push", [namedType("T")], namedType("void")), method("pop", [], namedType("T")), method("empty", [], namedType("bool")), method("size", [], namedType("int"))])]
      ])
    }
  ],
  [
    "mint:os",
    {
      builtin: true,
      builtinIncludes: ["<array>", "<cstdlib>", "<cstdio>", "<memory>", "<string>"],
      program: emptyProgram("mint:os"),
      imports: [],
      exports: new Map([
        [
          "OS",
          namespaceExport("OS", [
            functionMember("isLinux", [], namedType("bool"), "__doublemint_os_is_linux"),
            functionMember("isWindows", [], namedType("bool"), "__doublemint_os_is_windows"),
            functionMember("execute", [namedType("string")], namedType("string"), "__doublemint_os_execute")
          ])
        ],
        [
          "Env",
          namespaceExport("Env", [
            functionMember("get", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_env_get")
          ])
        ]
      ])
    }
  ],
  [
    "mint:regex",
    {
      builtin: true,
      builtinIncludes: ["<regex>", "<string>", "<string_view>"],
      program: emptyProgram("mint:regex"),
      imports: [],
      exports: new Map([
        ["Regex", classExport("Regex", [method("test", [namedType("string")], namedType("bool")), method("replace", [namedType("string"), namedType("string")], namedType("string"))])]
      ])
    }
  ],
  [
    "mint:io",
    {
      builtin: true,
      builtinIncludes: ["<iostream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:io"),
      imports: [],
      exports: new Map([
        [
          "IO",
          namespaceExport("IO", [
            functionMember("readLine", [namedType("string")], namedType("string"), "__doublemint_read_line")
          ])
        ],
        ["print", topLevelFunctionExport("print", [], namedType("void"), "__doublemint_print")],
        ["println", topLevelFunctionExport("println", [], namedType("void"), "__doublemint_println")]
      ])
    }
  ]
]);

export function isBuiltinModuleSource(source: string): boolean {
  return source.startsWith("mint:");
}

export function resolveBuiltinModule(source: string): ResolvedModule | null {
  const module = builtinModules.get(source);
  if (!module) {
    return null;
  }

  return {
    filepath: source,
    ...module
  };
}
