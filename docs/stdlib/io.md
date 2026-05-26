# `mint:io`

Standard input / output / error.

## Imports

```mint
import { print, println, IO } from "mint:io";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `print` | `print(value): void` | Write `value` to stdout without a newline. Accepts strings, numbers, bools. |
| `println` | `println(value): void` | Same as `print`, with a trailing newline. |
| `IO.eprint` | `IO.eprint(text: string): void` | Write to stderr without a newline. |
| `IO.eprintln` | `IO.eprintln(text: string): void` | stderr with newline. |
| `IO.flush` | `IO.flush(): void` | Flush stdout buffers. |

## Example

```mint
import { println, IO } from "mint:io";

export function main(): void {
  println("hello");
  IO.eprintln("warn: this goes to stderr");
}
```

## Template literal interop

`print` / `println` accept the template-literal lowering automatically —
each `${ident}` flows through `__doublemint_template_to_string` and
concatenates cleanly:

```mint
let name: string = "mint";
println(`hello ${name}`);
```
