// src/lib/contexts/auth/sqlite-session.repository.ts
//
// SQLite implementation of SessionRepository.
// Handles session storage operations using Drizzle ORM.

import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sessions } from '@db/schema';
import type { SessionRepository } from './auth.types';

/**
 * SQLite implementation of SessionRepository.
 * Stores sessions in the sessions table.
 */
export class SqliteSessionRepository implements SessionRepository {
  /**
   * Create a new session.
   */
  async create(sessionId: string, userId: string, expiresAt: Date): Promise<void> {
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt,
    });
  }

  /**
   * Find a session by ID.
   * Returns undefined if session doesn't exist or has expired.
   */
  async findById(sessionId: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const now = new Date();
    const result = await db
      .select({
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          gt(sessions.expiresAt, now)
        )
      )
      .limit(1);

    return result[0] || undefined;
  }

  /**
   * Delete a session by ID.
   */
  async delete(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /**
   * Delete all sessions for a user.
   */
  async deleteByUserId(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
