// scripts/inspect-db.mjs — dev utility, not part of the shipped scaffold.
import Database from 'better-sqlite3';
const db = new Database('./local.db');
const tables = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log('--- tables in local.db ---');
for (const t of tables) {
  console.log(t.name, '|', t.sql);
}
console.log('--- indexes ---');
const idx = db
  .prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name")
  .all();
for (const i of idx) {
  console.log(i.name, 'on', i.tbl_name, '|', i.sql);
}
db.close();
