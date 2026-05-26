# `mint:regex`

PCRE-style regular expressions backed by `std::regex`.

## Imports

```mint
import { Regex } from "mint:regex";
```

## `Regex` class

| Method | Signature | Purpose |
| --- | --- | --- |
| `new Regex(pattern: string)` | | Compile a pattern. |
| `match(text: string): bool` | | True if the pattern matches anywhere in `text`. |
| `matches(text: string): string[]` | | Every non-overlapping match. |
| `replace(text: string, with: string): string` | | First-match replace. |
| `replaceAll(text: string, with: string): string` | | All matches. |
| `split(text: string): string[]` | | Split on matches. |
| `capture(text: string): string[]` | | First match's capture groups (0 = whole match). |

## Example

```mint
import { Regex } from "mint:regex";
import { println } from "mint:io";

export function main(): void {
  let words: Regex = new Regex("[a-z]+");

  let line: string = "hello, world!";
  for (let m of words.matches(line)) {
    println(m);
  }

  let cleaned: string = words.replaceAll("123 hello 456 mint", "X");
  println(cleaned);
}
```

Patterns are compiled at construction time, so reusing a `Regex`
instance across loop iterations is the fast path.
