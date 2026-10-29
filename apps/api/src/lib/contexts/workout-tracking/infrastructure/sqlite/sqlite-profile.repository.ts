// src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts
//
// SQLite-backed implementation of ProfileRepository.
//
// Per ADR-007 + ADR-012:
//   - consumes the Drizzle `db` instance from `src/lib/db/client.ts`.
//   - visibility/ownership guards live HERE in Round 1 (no RLS until Round 6).
//
// Per ADR-011: `implements`, not `extends`.
//
// Note: `email` column was added in story 1.3 (LocalAuthService).
// `findByEmail` now queries the email column.

import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { profiles, type Profile, type NewProfile } from '@db/schema';
import { ProfileRepository } from '@/lib/contexts/workout-tracking/domain/profile.repository';

export class SqliteProfileRepository implements ProfileRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Profile | undefined> {
    const row = await this.db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return row[0];
  }

  async findByEmail(email: string): Promise<Profile | undefined> {
    const row = await this.db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    return row[0];
  }

  async create(input: NewProfile): Promise<Profile> {
    const [row] = await this.db.insert(profiles).values(input).returning();
    if (!row) {
      throw new Error('Failed to insert profile: no row returned.');
    }
    return row;
  }

  async update(
    id: string,
    patch: Partial<Pick<Profile, 'displayName' | 'routineType' | 'weightUnit'>>,
  ): Promise<Profile> {
    const [row] = await this.db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, id))
      .returning();
    if (!row) {
      throw new Error(`Profile not found: ${id}`);
    }
    return row;
  }
}
