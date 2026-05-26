---
layout: home

hero:
  name: Doublemint
  text: "A .dlm → C++20 transpiler"
  tagline: TypeScript-style ergonomics. Native C++ binaries. One curated stdlib.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/mysbryce/doublemint

features:
  - icon: 🌱
    title: TypeScript-style source
    details: Familiar syntax, explicit types, structs, enums, match, generics on free functions, async / await.
  - icon: ⚡
    title: Native binaries
    details: Output is plain C++20. Build with g++ or clang++. Warning-free under -Wall -Wextra -Werror -O3.
  - icon: 📦
    title: Batteries included
    details: 24 mint:* modules — HTTP server (uWebSockets), SQLite, crypto, JSON, schema validation, regex, process memory, and more.
  - icon: 🛠
    title: Single binary toolchain
    details: doublemint check / emit / build / fmt / repl / init / info / version — all in one CLI.
  - icon: 🧪
    title: Tested at every step
    details: 188+ vitest tests, every example builds end-to-end, and every release ships with a patch note.
  - icon: 🔌
    title: Native interop
    details: Bind existing C/C++ libraries with extern "header" blocks, nativeSources, pointer / reference signatures, defer cleanup.
---

## Quick taste

```mint
import { println } from "mint:io";
import { String } from "mint:string";

enum Day { Mon, Tue, Wed }

async function fetchLevel(id: int): int {
  return id * 10;
}

export function main(): void {
  let day: Day = Day.Tue;
  let label: string = match (day) {
    Day.Mon => "monday",
    Day.Tue => "tuesday",
    _ => "wednesday"
  };

  let level: int = await fetchLevel(7);

  println("hello " + "mint".upper() + " — " + label);
  println("level = " + level.toString());
}
```

```bash
$ doublemint build hello.dlm --out hello
$ ./hello
hello MINT — tuesday
level = 70
```
