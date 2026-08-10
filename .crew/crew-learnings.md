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