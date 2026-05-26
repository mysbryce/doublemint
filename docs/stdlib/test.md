# `mint:test`

Tiny in-process test runner. Designed to keep `.dlm`-side tests inside
the language without reaching for an external harness.

## Imports

```mint
import { Test } from "mint:test";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Test.run` | `(name: string, fn: function(): void): void` | Run a test; prints `name … ok / FAIL`. |
| `Test.expectTrue` | `(value: bool, label: string): void` | Assert a bool. |
| `Test.expectInt` | `(actual: int, expected: int, label: string): void` | Int equality. |
| `Test.expectString` | `(actual: string, expected: string, label: string): void` | String equality. |
| `Test.expectBool` | `(actual: bool, expected: bool, label: string): void` | Bool equality. |
| `Test.report` | `(): int` | Print the summary and return 0 / 1. |
| `Test.passed` | `(): int` | Pass count. |
| `Test.failed` | `(): int` | Fail count. |

## Example

```mint
import { Test } from "mint:test";
import { String } from "mint:string";

export function main(): void {
  Test.run("addition", fn(): void => {
    Test.expectInt(1 + 1, 2, "1+1");
    Test.expectInt(10 - 3, 7, "10-3");
  });

  Test.run("string upper", fn(): void => {
    Test.expectString(String.upper("mint"), "MINT", "upper(mint)");
  });

  Test.run("bool", fn(): void => {
    Test.expectBool(true, true, "truth");
    Test.expectTrue(5 > 3, "5>3");
  });

  Test.report();
}
```

Output:

```text
  addition ... ok
  string upper ... ok
  bool ... ok

3 passed, 0 failed
```

The runner throws inside a test body are caught and reported as
`FAIL (threw)` instead of aborting the binary, so one bad test doesn't
hide later ones. `Test.report()` returns `0` on full pass and `1`
otherwise — wire that into your CI exit code.
