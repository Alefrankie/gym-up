// src/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-profile.repository.ts
//
// SQLite-backed implementation of PublicProfileRepository.
// Per ADR-007: implements the abstract port, consumes the Drizzle `db`.
// Per ADR-004: read-all — no ownership guard.
// Per golden-rules (Cross-Context Isolation): reads directly from the
// profiles table, NOT via ProfileRepository from auth context.

import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { profiles } from '@db/schema';
import {
  type PublicProfileRepository,
  type PublicProfileRow,
} from '../../domain/public-profile.repository';

export class SqlitePublicProfileRepository implements PublicProfileRepository {
  constructor(private readonly db: Db) {}

  async getAll(): Promise<PublicProfileRow[]> {
    const rows = await this.db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        routineType: profiles.routineType,
      })
      .from(profiles);
    return rows;
  }

  async getById(id: string): Promise<PublicProfileRow | undefined> {
    const [row] = await this.db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        routineType: profiles.routineType,
      })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return row;
  }
}
