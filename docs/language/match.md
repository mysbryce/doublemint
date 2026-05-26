# Pattern matching

`match` works on any value that supports `==`. There are two forms:
**statement** and **expression**.

## Statement form

```mint
match (n) {
  0 => { return "zero"; },
  1 => { return "one"; },
  _ => { return "many"; }
}
```

Rules:

- Arms separated by `,`. The trailing arm doesn't need a `,`.
- Arm bodies can be a single expression (`=> println("hi")`, no semicolon)
  or a block (`=> { … }` with its own statements).
- At most one `_` arm (`DLM4071` if you write two).
- Pattern types are checked against the discriminant, so a `Day` value
  rejects an `int` pattern at compile time.

## Expression form

```mint
let label: string = match (n) {
  0 => "zero",
  1 => "one",
  _ => "many"
};
```

Rules:

- Each arm is `pattern => expression` (no braces, no semicolon).
- Every arm's value must have the same type (`DLM4073`).
- A `_` wildcard arm is **required** so the expression is total
  (`DLM4074`).
- Lowered to an IIFE that hoists the discriminant once and dispatches
  through a chained ternary:

```cpp
([&]() {
  const auto __dlm_match_v = day;
  return (__dlm_match_v == Day::Mon) ? std::string("monday")
       : (__dlm_match_v == Day::Tue) ? std::string("tuesday")
       : std::string("wednesday");
})()
```

## Enum dispatch

```mint
enum Day { Mon, Tue, Wed }

export function name(d: Day): string {
  return match (d) {
    Day.Mon => "monday",
    Day.Tue => "tuesday",
    _ => "wednesday"
  };
}
```

## Int / string dispatch

```mint
match (status) {
  200 => println("ok"),
  404 => println("not found"),
  _ => println("other")
}
```

```mint
match (kind) {
  "alpha" => println("a"),
  "beta" => println("b"),
  _ => println("other")
}
```

## Lowering for the statement form

```cpp
{
  const auto __dlm_match_0 = day;
  if (__dlm_match_0 == Day::Mon) { /* ... */ }
  else if (__dlm_match_0 == Day::Tue) { /* ... */ }
  else { /* wildcard arm */ }
}
```

The discriminant is captured once so it can be a complex expression without
re-evaluation.

## Coming soon

- Patterns with bindings — `Some(x) => …`
- Match arm guards — `pattern if cond => …`
