# PROJECT_PLAN.md

# 🌿 Project Plan: Doublemint Language Transpiler (`.dlm`)

Doublemint (`.dlm`) is a statically-typed, source-to-source compiler (transpiler) that brings the pristine, human-ergonomic developer experience (DX) of **TypeScript** to the world of high-performance **C++**.

## ✅ Production Decision Snapshot

The implementation direction is locked in:

* **Compiler implementation:** TypeScript / Node.js.
* **Parser strategy:** Hand-written recursive descent parser.
* **Product target:** Production foundation first, full roadmap second. This is not a disposable MVP.
* **Output structure:** Emit `.hpp` and `.cpp` per module.
* **Module resolver:** Strict graph resolver with missing import, duplicate export, circular import, and type-only import handling.
* **Type system:** Explicit types required, with limited safe inference.
* **Ownership model:** Source-level value semantics; compiler may emit immutable heavy struct params as `const T&`.
* **Mutation model:** `let` is mutable, `const` is immutable.
* **String model:** Initial `string` emits to `std::string`; `std::string_view` optimization is deferred.
* **Diagnostics:** Rich diagnostics with file, line, column, snippet, caret, and error codes.
* **Testing:** Layered tests, golden emitted C++ snapshots, native compile tests, and binary execution tests.
* **Distribution:** npm package with `doublemint` bin.
* **Build behavior:** CLI emits C++ and can optionally invoke GCC/Clang.
* **Config:** `doublemint.config.json`.

See `PRODUCT_SPEC.md` and `docs/adr/ADR-0001-production-foundation.md`.

## 🎯 1. Core Philosophies & Design Principles

Before a single line of compiler code is written, all design choices must filter through these absolute mandates:

* **Ergonomic for Humans:** Syntax must be beautiful, intuitive, and clean. Boilerplate code, redundant declarations, and cognitive overhead (e.g., separating header files `.h` from source files `.cpp`) are eliminated.
* **Don't Repeat Yourself (DRY):** Code should state its intent exactly once. Types are explicitly declared but never duplicated needlessly across multiple files.
* **Zero-Overhead Abstract Syntax:** Every abstraction introduced by Doublemint must compile down to the absolute most efficient modern C++ equivalent. If an abstraction cannot achieve raw C++ native speed, it must not be added.
* **Scalability & Maintainability:** The architecture enforces a decoupled modular design, separating lexical, syntactic, semantic, and emission concerns. The generated C++ must mirror a production-grade directory structure suitable for large-scale codebases.

---

## 🏗️ 2. Recommended Scalable Project Directory Layout

To maintain a decoupled, testable, and highly scalable codebase, the compiler toolchain itself must follow this domain-driven directory structure:

```
doublemint/
├── bin/                        # Compiled CLI executables
├── src/                        # Compiler Source Code
│   ├── core/                   # CLI entry, driver, and global orchestrator
│   ├── lexer/                  # Lexical analysis (Source -> Token Streams)
│   ├── parser/                 # Syntactic analysis (Tokens -> AST Nodes)
│   │   ├── ast/                # Type definitions for all AST structural nodes
│   │   └── rules/              # Modular grammar rules (Functions, Statements, Expressions)
│   ├── semantic/               # Type checking, Symbol Table, Scope, and Reference Optimizations
│   ├── emitter/                # Code generation (AST -> Clean Modern C++)
│   └── utils/                  # Shared internal loggers, errors, and string helpers
├── tests/                      # 100% Comprehensive Test Suite
│   ├── unit/                   # Isolated component tests (Lexer tests, individual Parser rules)
│   ├── integration/            # E2E Compilation tests (.dlm -> .cpp -> binary verification)
│   └── fixtures/               # Input sample files (.dlm) representing real test cases
├── Cargo.toml / package.json   # Package manifest (depending on your choice of implementation language)
└── README.md

```

---

## 📋 3. Comprehensive End-to-End Showcase

This showcase demonstrates how the Doublemint compilation pipeline resolves structural file dependencies, standard runtime imports, explicit type-only imports, and target C++ mapping.

### 📁 Scenario Context: 3-File Modular Setup

#### 📄 File 1: `types.dlm` (Type Definitions Only)

```typescript
export type PlayerId = int;

export struct PlayerProfile {
    id: PlayerId;
    username: string;
    level: int;
}

```

#### 📄 File 2: `math_utils.dlm` (Internal Utility Module)

```typescript
extern "cmath" {
    function sqrt(num: double): double;
}

export function calculateDistance(x1: float, y1: float, x2: float, y2: float): float {
    let dx: double = (x2 - x1);
    let dy: double = (y2 - y1);
    return sqrt((dx * dx) + (dy * dy)) as float;
}

```

#### 📄 File 3: `main.dlm` (Application Entrypoint)

```typescript
import type { PlayerProfile } from "./types";
import { calculateDistance } from "./math_utils";

function processPlayer(profile: PlayerProfile): void {
    let x: float = 10.0;
    let y: float = 20.0;
    
    let dist: float = calculateDistance(0.0, 0.0, x, y);
    
    // Explicit ergonomic copying
    let saved_profile: PlayerProfile = copy profile;
    saved_profile.level = saved_profile.level + 1;
}

```

---

### 🌲 Structural AST Node Representation (Parsed `main.dlm`)

The parser generates a clear, deterministic AST array where structural modules are flattened into a single-pass verification tree:

```json
{
  "type": "Program",
  "sourceFile": "main.dlm",
  "body": [
    {
      "type": "ImportTypeDeclaration",
      "specifiers": ["PlayerProfile"],
      "source": "./types"
    },
    {
      "type": "ImportDeclaration",
      "specifiers": ["calculateDistance"],
      "source": "./math_utils"
    },
    {
      "type": "FunctionDeclaration",
      "id": "processPlayer",
      "params": [
        { "id": "profile", "valueType": "PlayerProfile" }
      ],
      "returnType": "void",
      "body": [
        {
          "type": "VariableDeclaration",
          "kind": "let",
          "id": "x",
          "valueType": "float",
          "init": { "type": "Literal", "value": 10.0 }
        },
        {
          "type": "VariableDeclaration",
          "kind": "let",
          "id": "y",
          "valueType": "float",
          "init": { "type": "Literal", "value": 20.0 }
        },
        {
          "type": "VariableDeclaration",
          "kind": "let",
          "id": "dist",
          "valueType": "float",
          "init": {
            "type": "CallExpression",
            "callee": "calculateDistance",
            "arguments": [
              { "type": "Literal", "value": 0.0 },
              { "type": "Literal", "value": 0.0 },
              { "type": "Identifier", "name": "x" },
              { "type": "Identifier", "name": "y" }
            ]
          }
        },
        {
          "type": "VariableDeclaration",
          "kind": "let",
          "id": "saved_profile",
          "valueType": "PlayerProfile",
          "init": {
            "type": "CopyExpression",
            "argument": { "type": "Identifier", "name": "profile" }
          }
        },
        {
          "type": "ExpressionStatement",
          "expression": {
            "type": "AssignmentExpression",
            "left": "saved_profile.level",
            "right": {
              "type": "BinaryExpression",
              "operator": "+",
              "left": "saved_profile.level",
              "right": { "type": "Literal", "value": 1 }
            }
          }
        }
      ]
    }
  ]
}

```

---

### 🚀 Transpiled Target Output: `main.cpp` (C++20 Compliant)

Doublemint simplifies module aggregation. Rather than copying structural code, standard `import` maps smoothly to standard relative inclusions, while `import type` resolves cleanly down to purely physical dependency declarations:

```cpp
#include <string>
#include <string_view>

// Resolved from import type { PlayerProfile } from "./types"
#include "types.hpp"

// Resolved from import { calculateDistance } from "./math_utils"
#include "math_utils.hpp"

// Implicit Optimization: 'profile' is parsed as an Object. 
// To protect performance, Doublemint emits it as a const reference 'const PlayerProfile&'
void processPlayer(const PlayerProfile& profile) {
    float x = 10.0f;
    float y = 20.0f;
    
    float dist = calculateDistance(0.0f, 0.0f, x, y);
    
    // Explicitly requested deep copy via the human 'copy' keyword
    PlayerProfile saved_profile = profile; 
    
    saved_profile.level = saved_profile.level + 1;
}

```

---

## 🛠️ 4. Rigorous Implementation TODO List

> ### 🛑 MANDATORY TESTING RULE:
> 
> 
> Every task below represents a non-negotiable architectural phase. A task is marked complete **ONLY** when its accompanying automated test suites pass flawlessly. Partial logic or untested code is considered broken.

### 🟩 Phase 1: Lexical Analysis Pipeline (The Lexer)

* [x] **1.1 Global Token Definitions:** Enumerate strict token states (`LET`, `CONST`, `CONSTEXPR`, `EXTERN`, `IMPORT`, `TYPE`, `EXPORT`, `COPY`, `STRUCT`, `ARROW_OP`, delimiters, operators, and literals).
* [x] **1.2 High-Speed Lexer Scanner:** Write a non-backtracking scanner running in linear $O(n)$ time to stream tokens from raw input buffers.
* [x] **1.3 Source Mapping:** Embed tracking properties (`line_number`, `column_offset`, `absolute_filepath`) natively into each scanned Token.
* [x] **🧪 REQUIRED TEST CHECK:** Provide 100% test coverage over corrupted input (e.g., unterminated strings, unrecognizable glyphs). Lexer must gracefully halt, raising accurate coordinate error diagnostic windows without crashing.

### 🟩 Phase 2: Syntactic Specification (The Parser)

* [x] **2.1 Explicit Type Annotations Parser:** Write defensive recursive descent parser loops enforcing type validation on all assignment statements (e.g., throwing a syntax error immediately if `: type` syntax is missing).
* [x] **2.2 Module Import/Export Grammar:** Implement explicit parsing tracks for standard symbols: `import { x } from "mod"` versus specific type definitions: `import type { y } from "mod"`.
* [x] **2.3 Structure Syntax Extraction:** Implement rules targeting the clean `struct` layout and multi-return tuples (`[int, string]`).
* [x] **2.4 Ergonomic Copy Expressions:** Catch the prefix keyword `copy` preceding identifier nodes, packing them neatly into safe `CopyExpression` structures.
* [x] **🧪 REQUIRED TEST CHECK:** Verify that running invalid module loops or structural variations results in syntax rejection. The output AST must parse correctly down to perfectly formed JSON formats against validation schemas.

### 🟩 Phase 3: Semantic Enforcement & Smart Reference Matrix

* [x] **3.1 Scalable Block-Scoped Symbol Table:** Implement nested lexical environment tracking managing localized scopes, protecting variable accessibility limits across multi-directory projects.
* [x] **3.2 Type Inference Safety Guard:** Lock type operations. Disallow raw mismatch operations (`int` vs `string`) during validation.
* [x] **3.3 Automated Reference Optimizer:** Build an AST analyzer that detects parameters receiving heavy custom structs. If no modification occurs and the `copy` marker is absent, flag the parameter to emit as a performance-optimal `const T&` automatically.
* [x] **🧪 REQUIRED TEST CHECK:** Run semantic test fixtures tracking illegal memory operations. Assert that trying to implicitly mutate arguments inside safe references fails type check operations before C++ emission.

### 🟩 Phase 4: Zero-Overhead Output Emission (The Emitter)

* [x] **4.1 Memory Guarded String Mapping:** Build an output strategy mapping `string` usage:
* Literal expressions compile safely down to efficient stack-allocated `std::string_view`.
* Mutated string objects output directly into heap-allocated `std::string`.


* [x] **4.2 Code Module Aggregation:** Direct `import` mappings into explicit `#include` chains, while cleanly unwrapping native `extern` modules without adding runtime overhead.
* [x] **4.3 Structural Tuple Binding Conversion:** Convert TypeScript array-destructuring returns (`const [val, err] = action()`) into modern C++ structured bindings (`auto [val, err] = action()`) utilizing native `std::tuple` optimizations.
* [x] **🧪 REQUIRED TEST CHECK:** Run the emitter against advanced complex algorithms. The generated `.cpp` and `.hpp` outputs must achieve perfect compilation under GCC/Clang with flag conditions `-Wall -Wextra -Werror -std=c++20 -O3` without generating warnings or errors.

### 🟩 Phase 5: CLI Automation, End-to-End Build Tools, and Profiling

* [x] **5.1 Direct Production Compiler CLI:** Implement the final unified command architecture interface (`doublemint build <file.dlm> --out <exec>`).
* [x] **5.2 Native Compiler Integration:** Build automatic internal child execution pipes that securely trigger local native configurations (GCC/Clang) seamlessly, passing generation parameters cleanly down to binary files.
* [x] **🧪 REQUIRED TEST CHECK:** Compile complex multi-module math and state test files. Run the resulting binaries and verify their execution, ensuring zero memory overhead, high performance, and correct output logic.
