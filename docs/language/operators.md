# Operators

Precedence is C++-style (lowest to highest):

```
||   &&   |   ^   &   == !=   < <= > >=   << >>   + -   * / %   unary   postfix
```

## Arithmetic

```mint
let sum: int = 1 + 2;
let diff: int = 5 - 2;
let prod: int = 3 * 4;
let div: int = 10 / 3;       // integer division on int
let rem: int = 10 % 3;       // % requires integer operands (DLM4080)
```

## Comparison

```mint
1 == 1   // bool
1 != 2
3 < 4
3 <= 4
4 > 3
4 >= 3
```

## Logical

```mint
!flag
flag && other
flag || other
```

## Bitwise

```mint
0xF0 & 0x0F    // requires int operands (DLM4080)
0xF0 | 0x0F
0xFF ^ 0x0F
~mask          // unary; requires int operand (DLM4081)
```

## Shift

```mint
1 << 4    // 16
256 >> 2  // 64
```

Lexed as two adjacent `<` / `>` tokens — Mint reassembles them at parse
time so generic-type parsing (`int[][]`, nested `Optional<T>`, etc.) stays
intact.

## Assignment family

```mint
n = 1;

n += 1;   n -= 1;   n *= 2;   n /= 2;
n %= 3;
n &= 0xF; n |= 0xF; n ^= 0xF;
n <<= 1;  n >>= 1;
```

Compound assignments share the LHS-must-be-mutable rule with `=`. The
integer-only operators (`%= &= |= ^= <<= >>=`) additionally require integer
operands (`DLM4082`).

## Prefix / postfix

```mint
let n: int = 0;

++n;   // prefix — value is post-update
n++;   // postfix — value is pre-update
--n;
n--;
```

## Ternary

```mint
let label: string = (n > 0) ? "pos" : "non-pos";
```

## Template literals

```mint
let name: string = "mint";
let greeting: string = `hello ${name}`;
```

Each `${ident}` is lowered through
`__doublemint_template_to_string(ident)` — works for strings, numbers,
bools, and anything streamable.

## String concatenation

```mint
let greeting: string = "hello " + name;
```

The checker tags string + string as a concat; the emitter wraps both sides
in `std::string(...)` so `string_view` operands convert cleanly.

## Match expression

```mint
let label: string = match (day) {
  Day.Mon => "monday",
  Day.Tue => "tuesday",
  _ => "wednesday"
};
```

See [Pattern matching](./match).

## Method-style on primitives

Any builtin namespace function whose first parameter unifies with the
receiver becomes a method:

```mint
let name: string = "mint";
println(name.upper());        // == String.upper(name)

let xs: int[] = [3, 1, 2];
println(xs.length().toString()); // Array.length(xs)
```

Numeric and bool primitives also get a built-in `.toString()` without
needing an import:

```mint
let n: int = 42;
let b: bool = true;

println(n.toString()); // "42"
println(b.toString()); // "true"
```
