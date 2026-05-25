import { describe, expect, it } from "vitest";
import { DoublemintDiagnostic, parseProgram, scanTokens } from "../../src/index.js";

function parse(source: string) {
  return parseProgram(scanTokens(source, "main.dlm"), "main.dlm");
}

describe("parseProgram", () => {
  it("parses imports, type aliases, structs, externs, and functions", () => {
    const program = parse(`
      import type { PlayerProfile } from "./types";
      import { calculateDistance } from "./math_utils";

      export type PlayerId = int;

      export struct PlayerProfile {
        id: PlayerId;
        username: string;
        level: int;
      }

      extern "cmath" {
        function sqrt(num: double): double;
      }

      function processPlayer(profile: PlayerProfile): void {
        let x: float = 10.0;
        let y: float = 20.0;
        let dist: float = calculateDistance(0.0, 0.0, x, y);
        let saved_profile: PlayerProfile = copy profile;
        saved_profile.level = saved_profile.level + 1;
      }
    `);

    expect(program.body).toHaveLength(6);
    expect(program.body[0]).toMatchObject({
      type: "ImportDeclaration",
      typeOnly: true,
      specifiers: ["PlayerProfile"],
      source: "./types"
    });
    expect(program.body[3]).toMatchObject({
      type: "StructDeclaration",
      exported: true,
      id: "PlayerProfile",
      fields: [
        { id: "id" },
        { id: "username" },
        { id: "level" }
      ]
    });
    expect(program.body[4]).toMatchObject({
      type: "ExternBlockDeclaration",
      source: "cmath",
      declarations: [{ id: "sqrt", extern: true }]
    });
    expect(program.body[5]).toMatchObject({
      type: "FunctionDeclaration",
      id: "processPlayer",
      body: [
        { type: "VariableDeclaration", id: "x" },
        { type: "VariableDeclaration", id: "y" },
        { type: "VariableDeclaration", id: "dist" },
        {
          type: "VariableDeclaration",
          id: "saved_profile",
          init: { type: "CopyExpression" }
        },
        { type: "ExpressionStatement" }
      ]
    });
  });

  it("parses cast expressions", () => {
    const program = parse(`
      function main(): void {
        let x: float = sqrt(4.0) as float;
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        {
          type: "VariableDeclaration",
          init: {
            type: "CastExpression",
            targetType: { type: "NamedType", name: "float" }
          }
        }
      ]
    });
  });

  it("rejects missing explicit variable type annotations", () => {
    expect(() =>
      parse(`
        function main(): void {
          let x = 1;
        }
      `)
    ).toThrow(DoublemintDiagnostic);
  });

  it("parses if else statements and bool literals", () => {
    const program = parse(`
      function main(): void {
        if (true) {
          print("yes");
        } else {
          print("no");
        }
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        {
          type: "IfStatement",
          condition: { type: "Literal", literalKind: "bool", value: true },
          thenBranch: [{ type: "ExpressionStatement" }],
          elseBranch: [{ type: "ExpressionStatement" }]
        }
      ]
    });
  });

  it("parses array types, literals, and index expressions", () => {
    const program = parse(`
      function main(): void {
        let values: int[] = [1, 2, 3];
        values[0] = values[1];
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        {
          type: "VariableDeclaration",
          valueType: { type: "ArrayType", elementType: { name: "int" } },
          init: { type: "ArrayLiteral", elements: [{}, {}, {}] }
        },
        {
          type: "ExpressionStatement",
          expression: {
            type: "AssignmentExpression",
            left: { type: "IndexExpression" },
            right: { type: "IndexExpression" }
          }
        }
      ]
    });
  });

  it("parses while and for loops with comparisons", () => {
    const program = parse(`
      function main(): void {
        let total: int = 0;
        while (total < 3) {
          total = total + 1;
        }
        for (let i: int = 0; i <= 3; i = i + 1) {
          total = total + i;
        }
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        { type: "VariableDeclaration", id: "total" },
        {
          type: "WhileStatement",
          condition: { type: "BinaryExpression", operator: "<" },
          body: [{ type: "ExpressionStatement" }]
        },
        {
          type: "ForStatement",
          init: { type: "VariableDeclaration", id: "i" },
          condition: { type: "BinaryExpression", operator: "<=" },
          increment: { type: "AssignmentExpression" },
          body: [{ type: "ExpressionStatement" }]
        }
      ]
    });
  });

  it("parses struct object literals", () => {
    const program = parse(`
      struct Profile {
        id: int;
        name: string;
      }

      function main(): void {
        let profile: Profile = Profile { id: 1, name: "mint" };
      }
    `);

    expect(program.body[1]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        {
          type: "VariableDeclaration",
          init: {
            type: "StructLiteral",
            typeName: "Profile",
            fields: [
              { id: "id", value: { type: "Literal", value: 1 } },
              { id: "name", value: { type: "Literal", value: "mint" } }
            ]
          }
        }
      ]
    });
  });

  it("parses tuple literals and tuple index expressions", () => {
    const program = parse(`
      function pair(): [int, string] {
        return (1, "mint");
      }

      function main(): void {
        let value: [int, string] = pair();
        print(value[0]);
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      returnType: { type: "TupleType", elements: [{ name: "int" }, { name: "string" }] },
      body: [
        {
          type: "ReturnStatement",
          argument: {
            type: "TupleLiteral",
            elements: [{ type: "Literal", value: 1 }, { type: "Literal", value: "mint" }]
          }
        }
      ]
    });
    expect(program.body[1]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        { type: "VariableDeclaration" },
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            arguments: [{ type: "IndexExpression" }]
          }
        }
      ]
    });
  });

  it("parses tuple destructuring declarations", () => {
    const program = parse(`
      function pair(): [int, string] {
        return (1, "mint");
      }

      function main(): void {
        const [count, label] = pair();
      }
    `);

    expect(program.body[1]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        {
          type: "DestructuringDeclaration",
          kind: "const",
          ids: ["count", "label"],
          init: { type: "CallExpression" }
        }
      ]
    });
  });

  it("parses switch statements", () => {
    const program = parse(`
      function main(): void {
        let name: string = "mint";
        switch (name) {
          case "mint": {
            print("yes");
          }
          default: {
            print("no");
          }
        }
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        { type: "VariableDeclaration", id: "name" },
        {
          type: "SwitchStatement",
          discriminant: { type: "Identifier", name: "name" },
          cases: [
            {
              test: { type: "Literal", value: "mint" },
              body: [{ type: "ExpressionStatement" }]
            }
          ],
          defaultBranch: [{ type: "ExpressionStatement" }]
        }
      ]
    });
  });

  it("parses lambda expressions and function types", () => {
    const program = parse(`
      function main(): void {
        let inc: function(int): int = fn (value: int): int => value + 1;
        print(inc(2));
      }
    `);

    expect(program.body[0]).toMatchObject({
      type: "FunctionDeclaration",
      body: [
        {
          type: "VariableDeclaration",
          valueType: {
            type: "FunctionType",
            params: [{ name: "int" }],
            returnType: { name: "int" }
          },
          init: {
            type: "LambdaExpression",
            params: [{ id: "value", valueType: { name: "int" } }],
            returnType: { name: "int" }
          }
        },
        {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "print" },
            arguments: [{ type: "CallExpression" }]
          }
        }
      ]
    });
  });
});
