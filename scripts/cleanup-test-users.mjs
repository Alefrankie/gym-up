// scripts/cleanup-test-users.mjs
// Removes test profiles (emails ending in @example.com) from local.db.
// Run once to clean up accumulated test data.

import Database from 'better-sqlite3';

const db = new Database('./local.db');

const result = db
  .prepare("DELETE FROM profiles WHERE email LIKE '%@example.com'")
  .run();

console.log(`Deleted ${result.changes} test profiles.`);

const remaining = db.prepare('SELECT id, email, display_name FROM profiles').all();
console.log(`Remaining profiles: ${remaining.length}`);
remaining.forEach((u) => console.log(`  ${u.email} | ${u.display_name}`));

db.close();
