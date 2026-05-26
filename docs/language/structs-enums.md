# Structs & enums

## Structs

```mint
struct Profile {
  id: int;
  name: string;
  level: int;
}

export function example(): void {
  let p: Profile = Profile { id: 1, name: "mint", level: 3 };
  let copy: Profile = copy p;
  copy.level = 99;
}
```

- Fields are typed and declared once.
- The literal form is `StructName { field: value, … }`.
- Field mutation is allowed only when the owning binding is mutable.
- Lowers to a plain C++ `struct`.

## Exporting structs

```mint
export struct Profile {
  id: int;
  name: string;
}
```

Other modules can `import { Profile } from "./that-module"` and either
construct or accept the struct in signatures.

## Enums

```mint
enum Day {
  Mon,
  Tue,
  Wed,
  Fri
}
```

- Unit variants only for now (no payload).
- `Day.Mon` resolves through the enum symbol; unknown variants raise
  `DLM4070`.
- Duplicate variants raise `DLM2083`; empty enums raise `DLM2086`.
- Lowers to `enum class Day { Mon, … };`. Member access `Day.Mon`
  rewrites to `Day::Mon` only when the receiver is a known enum name.

## Pattern matching enums

```mint
function label(d: Day): string {
  return match (d) {
    Day.Mon => "monday",
    Day.Tue => "tuesday",
    _ => "wednesday"
  };
}
```

See [Pattern matching](./match) for the full surface.

## Type aliases

```mint
type Score = int;
type PlayerId = int;

export function example(s: Score, id: PlayerId): void {
  // ...
}
```

`type` is a transparent alias — the checker treats `Score` and `int` as
the same type.

## Coming later

- Methods on structs (today everything is a free function).
- Generic struct types (today only free functions are generic).
- Enum variants with payloads (today variants are unit-only).
