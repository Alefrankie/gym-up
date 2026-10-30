// Migration 0016: "Sin género" goes away. Users who picked m or f keep it and count as having chosen; the rest move to
// 'm' (Home asks them once); studio recordings of the neutral wording are dropped.

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

describe('migration 0016_address_form_two', () => {
  it('moves neutral users to m, keeps explicit choices, and drops neutral recordings', () => {
    const db = new Database(':memory:');
    for (const f of files.filter((f) => f < '0016')) db.exec(readFileSync(join(dir, f), 'utf8'));
    const insert = db.prepare(`INSERT INTO profiles (id, email, password_hash, display_name, routine_type, address_form) VALUES (?, ?, 'h', 'U', 'hombre', ?)`);
    insert.run('u-neutral', 'n@example.com', 'neutral');
    insert.run('u-f', 'f@example.com', 'f');
    insert.run('u-m', 'm@example.com', 'm');
    const rec = db.prepare(`INSERT INTO coach_recordings (id, tone, locale, event, form, text, content_type, audio, bytes, updated_at) VALUES (?, 'gymrat', 'es', 'home', ?, 't', 'audio/webm', x'00', 1, 1)`);
    rec.run('a'.repeat(32), 'neutral');
    rec.run('b'.repeat(32), 'm');
    rec.run('c'.repeat(32), null);

    db.exec(readFileSync(join(dir, files.find((f) => f.startsWith('0016'))!), 'utf8'));

    const rows = db.prepare('SELECT id, address_form AS form, address_form_chosen AS chosen FROM profiles ORDER BY id').all();
    expect(rows).toEqual([
      { id: 'u-f', form: 'f', chosen: 1 },
      { id: 'u-m', form: 'm', chosen: 1 },
      { id: 'u-neutral', form: 'm', chosen: 0 },
    ]);
    const forms = db.prepare('SELECT form FROM coach_recordings ORDER BY id').all();
    expect(forms).toEqual([{ form: 'm' }, { form: null }]);
  });
});
