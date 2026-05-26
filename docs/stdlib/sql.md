# `mint:sql`

SQLite-backed relational storage. The SQLite amalgamation
(`sqlite3.c` + `sqlite3.h`) is vendored — no system dependency.

## Imports

```mint
import { Database, SqlResult } from "mint:sql";
```

## `Database` class

| Method | Signature | Purpose |
| --- | --- | --- |
| `new Database(path: string)` | | Open / create a SQLite file. Use `":memory:"` for an in-memory database. |
| `exec(sql: string): void` | | Run a statement without parameters / without results. |
| `execParams(sql: string, params: string[]): void` | | Run with `?`-style positional parameters. |
| `query(sql: string): SqlResult` | | Run a SELECT, return the result set. |
| `queryParams(sql: string, params: string[]): SqlResult` | | SELECT with parameters. |
| `lastInsertRowid(): int64` | | Row id of the last INSERT. |
| `close(): void` | | Release the handle. |

## `SqlResult` class

| Method | Signature | Purpose |
| --- | --- | --- |
| `rowCount(): int` | | Number of rows in the result. |
| `columnCount(): int` | | Number of columns. |
| `columnName(i: int): string` | | Column name by index. |
| `getString(row: int, column: string): string` | | Column value as text. |
| `getInt(row: int, column: string): int` | | Column value as int. |
| `getInt64(row: int, column: string): int64` | | Column value as int64. |
| `getDouble(row: int, column: string): double` | | Column value as double. |
| `getBytes(row: int, column: string): int[]` | | Blob bytes. |

## Example

```mint
import { Database, SqlResult } from "mint:sql";
import { println } from "mint:io";

export function main(): void {
  let db: Database = new Database(":memory:");

  db.exec("create table users (id integer primary key, name text)");
  db.execParams("insert into users (name) values (?)", ["mint"]);
  db.execParams("insert into users (name) values (?)", ["bun"]);

  let result: SqlResult = db.query("select id, name from users");
  for (let i: int = 0; i < result.rowCount(); i++) {
    let id: int = result.getInt(i, "id");
    let name: string = result.getString(i, "name");
    println(id.toString() + ": " + name);
  }

  db.close();
}
```

The SQLite amalgamation ships as a single 8.5MB `.c` file linked into
every program that imports `mint:sql`. The vendored copy is compiled
with `gcc -std=c11` for warning-free integration.
