import { Database, SqlResult } from "mint:sql";
import { println } from "mint:io";

export function main(): void {
  let db: Database = new Database();
  db.openMemory();

  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER)");
  db.execParams("INSERT INTO users (name, age) VALUES (?, ?)", ["alice", "30"]);
  db.execParams("INSERT INTO users (name, age) VALUES (?, ?)", ["bob", "25"]);
  db.execParams("INSERT INTO users (name, age) VALUES (?, ?)", ["carol", "40"]);

  println("last_row_id=", db.lastInsertRowId());
  println("changes=", db.changes());

  println("--- everyone, sorted by age ---");
  let all: SqlResult = db.query("SELECT id, name, age FROM users ORDER BY age");
  while (all.hasNext()) {
    println(all.getInt("id"), " ", all.getString("name"), " age=", all.getInt("age"));
    all.next();
  }
  all.close();

  println("--- adults over 28 ---");
  let adults: SqlResult = db.queryParams("SELECT name, age FROM users WHERE age > ? ORDER BY name", ["28"]);
  while (adults.hasNext()) {
    println(adults.getString("name"), " age=", adults.getInt("age"));
    adults.next();
  }
  adults.close();

  db.exec("UPDATE users SET age = age + 1");
  println("after birthday: changed=", db.changes());

  db.close();
}
