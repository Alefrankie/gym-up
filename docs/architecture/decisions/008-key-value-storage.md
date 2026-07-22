---
id: ADR-008
title: KeyValueStorage Abstraction
type: decision
status: accepted
date: 2026-07-21
---

# ADR-008: KeyValueStorage Abstraction

## Status

Accepted

## Context

Browser `localStorage` is used for ephemeral data (e.g., workout draft state, timer state, rest timer pause). Direct use of `window.localStorage` makes testing impossible without browser context.

## Decision

Create `KeyValueStorage` abstract class with two implementations:
- `BrowserKeyValueStorage` — uses `window.localStorage` (production)
- `SqliteKeyValueStorage` — uses SQLite `key_value` table (tests, e2e)

Use cases depend on the abstract class, never on browser API directly.

## Pattern

```ts
// Abstract class (contract)
abstract class KeyValueStorage {
  abstract get<T>(key: string): T | null;
  abstract set<T>(key: string, value: T): void;
  abstract delete(key: string): void;
  abstract has(key: string): boolean;
  abstract clear(): void;
}

// Browser implementation
class BrowserKeyValueStorage implements KeyValueStorage {
  get<T>(key: string): T | null {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
  set<T>(key: string, value: T): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  delete(key: string): void {
    window.localStorage.removeItem(key);
  }
  has(key: string): boolean {
    return window.localStorage.hasItem(key); // throws if not exists
  }
  clear(): void {
    window.localStorage.clear();
  }
}

// SQLite implementation
class SqliteKeyValueStorage implements KeyValueStorage {
  constructor(private db: Database) {}

  get<T>(key: string): T | null {
    const row = this.db.prepare('SELECT value FROM key_value WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  }

  set<T>(key: string, value: T): void {
    this.db.prepare(`
      INSERT INTO key_value (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(key, JSON.stringify(value), JSON.stringify(value));
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM key_value WHERE key = ?').run(key);
  }

  has(key: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM key_value WHERE key = ?').get(key);
    return !!row;
  }

  clear(): void {
    this.db.prepare('DELETE FROM key_value').run();
  }
}
```

> **Note**: Per [ADR-011](./011-implements-not-extends.md), concrete classes use `implements`, not `extends`. No inheritance chain.

## SQLite Schema

```sql
CREATE TABLE key_value (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Rationale

- Tests can use SQLite `key_value` table — fast, no browser needed.
- Production uses browser localStorage — same interface, different impl.
- Ephemeral data (timer state, drafts) lives outside DB domain tables.
- Per [ADR-007](./007-repository-pattern.md) pattern: abstract class, two impls.

## Use Cases for KeyValueStorage

- Workout draft state (in-progress workout data before save)
- Rest timer pause state
- User preferences not in profile (UI theme, etc.)
- Last-used filters, sort orders

## Consequence

- No code calls `window.localStorage` directly.
- All use cases that need persistence of ephemeral state depend on `KeyValueStorage`.
- Tests use `SqliteKeyValueStorage` with the same test DB.

## Referenced by

- [system.md](../system.md) — composition
- [workout-tracking context](../contexts/workout-tracking/readme.md) — rest timer, draft state
