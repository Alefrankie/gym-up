# Crew Learnings (Quarantine)

Single-confirmation / dubious / temporary rules. Graduate after 2+ confirmations
(skill rules integrate inline; project rules go to CLAUDE.md/AGENTS.md); delete
after 5+ sessions unused. Stable rules do NOT live here.

---
trigger: "before assuming a schema migration is missing for a table"
scope: project
confidence: 1
last-used: 2026-08-10
status: quarantine

---

Before assuming a `CREATE TABLE` migration is missing, grep `db/migrations/*.sql`
for the table name and check `db/migrations/meta/_journal.json`. The journal may
be stale (list fewer entries than files on disk). Reason: story 4.2 — Angel
flagged `progress_photos` as needing `0004_create_progress_photos.sql`, but the
table was already created in `0001_demonic_mordo.sql`. The journal only listed 2
entries while 4 migration files existed on disk.

---
trigger: "when a repository method reconstructs a derived value from input fields"
scope: project
confidence: 1
last-used: 2026-08-10
status: quarantine

---

When a repository method reconstructs a derived value (e.g. storagePath) from
input, verify the reconstruction honors all input fields and does not use
hardcoded defaults that override caller-provided values. Reason: story 4.2 —
`SqlitePhotoRepository.create()` hardcoded `extension: 'jpg'` in `buildStoragePath`,
ignoring the format the caller passed in `input.storagePath`. This silently broke
PNG/WEBP uploads (files saved as `.jpg`, served with `Content-Type: image/jpeg`).

---
trigger: "before changing vitest config environment default"
scope: project
confidence: 1
last-used: 2026-08-14
status: quarantine

---

Before changing `environment` in `vitest.config.ts`, run the full test suite first to confirm existing tests don't dependent on the current environment. Existing tests that use Node-specific APIs (e.g. `Request.json()`, `Buffer`, native fetch) will break silently when switched to `happy-dom` or `jsdom`. If you need a different environment for new tests, use per-file opt-in (`// @vitest-environment happy-dom`) instead of changing the global default. Reason: story 5.2 — changing default to `happy-dom` broke 12 route-handler tests that relied on Node's `Request.json()`.

---

trigger: "Drizzle db.run() with parameterized SQL"
scope: project
confidence: 2
last-used: 2026-08-14
status: quarantine

---

Drizzle's `BetterSQLite3Database.run(sql, params)` does NOT bind parameters correctly for complex DDL-style inserts. Always use the ORM insert pattern (`db.insert(table).values({...}).returning()`) for test fixtures. Raw `db.run()` with `?` placeholders will throw `RangeError: Too few parameter values were provided`. Reason: story 5.3 — 5 test files used `db.run(INSERT INTO profiles ...)` and all failed.

---

trigger: "Drizzle integer mode timestamp returns Date"
scope: skill
confidence: 2
last-used: 2026-08-14
status: quarantine

---

Drizzle's `integer('col', { mode: 'timestamp' })` returns `Date` objects from queries, not raw numbers. Similarly, `integer('col', { mode: 'timestamp_ms' })` also returns `Date`. Only `integer('col', { mode: 'number' })` returns `number`. Custom TypeScript interfaces that model Drizzle schema rows must use `Date` for timestamp columns, not `number`. Reason: story 5.3 — `NutritionEntry` interface used `number` for `createdAt` (schema uses `mode: 'timestamp'`) causing TS2322 type mismatches in repository comparisons.

---

trigger: "entries created in same second have identical createdAt"
scope: skill
confidence: 1
last-used: 2026-08-14
status: quarantine

---

SQLite's `unixepoch()` returns seconds. Entries created within the same second get identical `createdAt` values, making `ORDER BY created_at DESC` non-deterministic for ordering tests. For date-sensitive ordering tests, always inject explicit timestamps via optional DTO fields (e.g. `createdAt?: Date` in the input). Reason: story 5.3 — `findByUser returns entries newest first` test failed because both entries were created in the same second.