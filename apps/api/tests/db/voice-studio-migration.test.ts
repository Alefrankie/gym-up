// Migration 0017: the recordings made before the studio had several people were the admin's. They become the admin's
// takes and stay active, so the app keeps playing them.

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

describe('migration 0017_voice_studio_team', () => {
  it("turns the existing recordings into the admin's active takes", () => {
    const db = new Database(':memory:');
    for (const f of files.filter((f) => f < '0017')) db.exec(readFileSync(join(dir, f), 'utf8'));
    db.prepare(`INSERT INTO profiles (id, email, password_hash, display_name, routine_type) VALUES ('admin', 'Alefrank.m@gmail.com', 'h', 'Ale', 'hombre')`).run();
    db.prepare(`INSERT INTO coach_recordings (id, tone, locale, event, form, text, content_type, audio, bytes, updated_at) VALUES (?, 'gymrat', 'es', 'restEnd', 'm', '¡A la barra!', 'audio/webm', x'0102', 2, 42)`).run('a'.repeat(32));

    db.exec(readFileSync(join(dir, files.find((f) => f.startsWith('0017'))!), 'utf8'));

    const take = db.prepare('SELECT id, line_id AS lineId, author_id AS authorId, text, bytes, hex(audio) AS audio FROM studio_takes').get() as Record<string, unknown>;
    expect(take).toMatchObject({ lineId: 'a'.repeat(32), authorId: 'admin', text: '¡A la barra!', bytes: 2, audio: '0102' });
    expect(take.id).toMatch(/^[0-9a-f]{32}$/);
    expect(db.prepare('SELECT line_id AS lineId, take_id AS takeId FROM studio_active').all()).toEqual([{ lineId: 'a'.repeat(32), takeId: take.id }]);
  });
});
