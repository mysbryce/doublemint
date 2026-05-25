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
});
