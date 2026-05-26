# Lambdas & generics

## Lambdas

```mint
let inc: function(int): int = fn(value: int): int => value + 1;

let block: function(int): int = fn(value: int): int => {
  let doubled: int = value * 2;
  return doubled + 1;
};

let greet: function(string): void = fn(name: string): void => {
  println("hello " + name);
};
```

- `fn` is the keyword.
- Single-expression body: `=> expr`. Block body: `=> { … }`.
- Parameters and return type are explicit, same as named functions.
- Lambdas capture the surrounding scope by value (`[=]` in the emitted
  C++).

## Function types

```mint
let inc: function(int): int = fn(v: int): int => v + 1;
let consume: function(string, int): bool = fn(name: string, age: int): bool => age > 0;
```

Lowers to `std::function<R(P...)>`.

## Generic free functions

```mint
function first<T>(xs: T[]): T {
  return xs[0];
}

function pair<A, B>(a: A, b: B): [A, B] {
  return (a, b);
}

let n: int = first([1, 2, 3]);
let p: [string, int] = pair("mint", 42);
```

Rules:

- Type parameters live in angle brackets after the function name.
- Type arguments are inferred from the call site by unifying parameter
  types with the actual argument types.
- Generic structs / classes are **not** supported yet — only free
  functions.

## How inference works

The checker collects substitutions:

```ts
collectGenericSubstitutions(declaredParam, actualArg, subs);
```

…then applies them to the declared return type:

```ts
applyGenericSubstitution(declaredReturn, subs);
```

`T` placeholders get filled by whatever the call site passed. If two
arguments imply different substitutions for the same `T`, the checker
raises a type-mismatch diagnostic.

## Explicit type arguments

```mint
let n: int = first<int>([1, 2, 3]);
```

Type arguments in angle brackets can be passed explicitly when
inference isn't enough or you want to be explicit at the call site.

## Generic builtins

Most `mint:*` modules pass concrete types in their signatures, but a few
(`Array.map`, `Array.filter`, `Async.spawn`) accept lambdas with generic
parameters. They participate in the same inference machinery — call
them like any other generic function.
