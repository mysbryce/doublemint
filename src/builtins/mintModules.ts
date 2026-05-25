import type { SourceLocation } from "../lexer/token.js";
import type { Program, TypeNode } from "../parser/ast.js";
import type {
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

const builtinModules = new Map<string, Omit<ResolvedModule, "filepath">>([
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
