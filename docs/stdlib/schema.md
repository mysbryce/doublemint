# `mint:schema`

Declarative validation for JSON-ish data. Build a `Schema`, run it
against a `JsonValue`, get a `ValidationResult` with structured errors.

## Imports

```mint
import { Schema, ValidationResult } from "mint:schema";
import { Json } from "mint:json";
```

## Building a schema

```mint
let userSchema: Schema = Schema.object({
  id: Schema.int().min(1),
  name: Schema.string().minLength(2).maxLength(64),
  age: Schema.int().min(0).max(150).optional(),
  role: Schema.oneOf(["admin", "user", "guest"]),
  tags: Schema.array(Schema.string()).maxItems(8)
});
```

Constraint methods (all return the same `Schema` for chaining):

| Method | Applies to | Purpose |
| --- | --- | --- |
| `.optional()` | any | Field may be missing. |
| `.min(n) / .max(n)` | int / double | Bound the value. |
| `.minLength(n) / .maxLength(n)` | string | Bound the byte length. |
| `.minItems(n) / .maxItems(n)` | array | Bound the array length. |
| `.pattern(regex)` | string | Match a regex (PCRE-style). |
| `.oneOf(values)` | any | Membership test. |

## Validating

```mint
let raw: JsonValue = Json.parse(text);
let result: ValidationResult = userSchema.validate(raw);

if (result.ok()) {
  let user: JsonValue = result.value();
  println(user.field("name").asString());
} else {
  for (let err of result.errors()) {
    println(err.path + ": " + err.message);
  }
}
```

| `ValidationResult` method | Purpose |
| --- | --- |
| `ok(): bool` | True if the value passed every constraint. |
| `value(): JsonValue` | The validated value (only valid when `ok()`). |
| `errors(): ValidationError[]` | The list of constraint failures. |

`ValidationError` is a struct:

```mint
struct ValidationError {
  path: string;     // dotted path, e.g. "tags.2"
  message: string;  // human description
}
```

## Example

```mint
import { Json, Schema, ValidationResult } from "mint:schema";
import { println } from "mint:io";

export function main(): void {
  let schema: Schema = Schema.object({
    title: Schema.string().minLength(1),
    score: Schema.int().min(0).max(100)
  });

  let value = Json.parse("{\"title\":\"hi\",\"score\":42}");
  let result: ValidationResult = schema.validate(value);

  if (result.ok()) {
    println("ok");
  } else {
    for (let err of result.errors()) {
      println("error at " + err.path + ": " + err.message);
    }
  }
}
```
