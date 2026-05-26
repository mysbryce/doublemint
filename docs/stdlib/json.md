# `mint:json`

Encode and decode JSON.

## Imports

```mint
import { Json } from "mint:json";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Json.stringify` | `(value): string` | Encode a Mint value into JSON. Accepts strings, numbers, bools, arrays, structs. |
| `Json.stringifyPretty` | `(value): string` | Same but with two-space indent. |
| `Json.parse` | `(text: string): JsonValue` | Decode into a tagged `JsonValue`. |
| `Json.parseObject` | `(text: string): Map<string, string>` | Convenience: parse a JSON object into a string-keyed map. |

`JsonValue` exposes accessor helpers:

```mint
let value: JsonValue = Json.parse("{\"id\":1,\"name\":\"mint\"}");
if (value.isObject()) {
  let id: int = value.field("id").asInt();
  let name: string = value.field("name").asString();
}
```

| `JsonValue` method | Purpose |
| --- | --- |
| `isObject() / isArray() / isString() / isNumber() / isBool() / isNull()` | Tag check. |
| `asString() / asInt() / asDouble() / asBool()` | Cast accessor (throws on mismatch). |
| `field(name: string): JsonValue` | Object child. |
| `index(i: int): JsonValue` | Array child. |
| `keys(): string[]` | Field names of an object. |
| `length(): int` | Array length. |

## Example

```mint
import { Json } from "mint:json";
import { println } from "mint:io";

struct User {
  id: int;
  name: string;
}

export function main(): void {
  let u: User = User { id: 1, name: "mint" };
  let text: string = Json.stringify(u);
  println(text); // {"id":1,"name":"mint"}

  let back: JsonValue = Json.parse(text);
  println(back.field("name").asString());
}
```

For validation (required fields, type constraints, min/max), pair this
with [`mint:schema`](./schema).
