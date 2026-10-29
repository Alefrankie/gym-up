// src/lib/db/client.ts
//
// Database handle type shared by every repository (ADR-012).
//
// The runtime handle is created per environment and injected:
//   - Cloudflare Workers: `drizzle(env.DB, { schema })` (D1), see the Nest providers.
//   - Tests: `drizzle(new Database(':memory:'), { schema })` (better-sqlite3).
// Both are SQLite-dialect Drizzle databases, so repositories only depend on
// this structural type.

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from '@db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = BaseSQLiteDatabase<'sync' | 'async', any, typeof schema>;
