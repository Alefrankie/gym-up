import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('routine weekday migration', () => {
  it('preserves legacy assignments and enforces valid unique days with cascade cleanup', () => {
    const db = new Database(':memory:');
    try {
      db.pragma('foreign_keys = ON');
      db.exec(`CREATE TABLE routine_days (id text PRIMARY KEY, weekday integer);
        INSERT INTO routine_days VALUES ('upper', 1), ('lower', NULL), ('sunday', 0);`);
      db.exec(readFileSync(join(__dirname, '../../db/migrations/0027_routine_day_weekdays.sql'), 'utf8'));
      expect(db.prepare('SELECT * FROM routine_day_weekdays ORDER BY routine_day_id').all()).toEqual([
        { routine_day_id: 'sunday', weekday: 0 },
        { routine_day_id: 'upper', weekday: 1 },
      ]);
      db.prepare('INSERT INTO routine_day_weekdays VALUES (?, ?)').run('upper', 3);
      expect(db.prepare('SELECT weekday FROM routine_day_weekdays WHERE routine_day_id = ? ORDER BY weekday').all('upper')).toEqual([{ weekday: 1 }, { weekday: 3 }]);
      expect(() => db.prepare('INSERT INTO routine_day_weekdays VALUES (?, ?)').run('upper', 3)).toThrow();
      expect(() => db.prepare('INSERT INTO routine_day_weekdays VALUES (?, ?)').run('upper', 7)).toThrow();
      db.prepare('DELETE FROM routine_days WHERE id = ?').run('upper');
      expect(db.prepare('SELECT * FROM routine_day_weekdays WHERE routine_day_id = ?').all('upper')).toEqual([]);
    } finally {
      db.close();
    }
  });
});
