// src/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-workout.repository.ts
//
// SQLite-backed implementation of PublicWorkoutRepository.
// Per ADR-007: implements the abstract port, consumes the Drizzle `db`.
// Per ADR-004: read-all — no ownership guard.
// Per golden-rules (Cross-Context Isolation): reads directly from the
// workouts table, NOT via WorkoutRepository from workout-tracking context.

import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { workouts } from '@db/schema';
import type { PublicWorkoutRepository } from '../../domain/public-workout.repository';

export class SqlitePublicWorkoutRepository implements PublicWorkoutRepository {
  constructor(private readonly db: Db) {}

  async getCompletedCount(userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: workouts.id })
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'completed')),
      );
    return rows.length;
  }

  async getLastWorkoutDate(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ workoutDate: workouts.workoutDate })
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'completed')),
      )
      .orderBy(desc(workouts.workoutDate))
      .limit(1);

    if (!row) return null;
    return toDateKey(row.workoutDate);
  }

  async getCompletedByUserId(
    userId: string,
  ): Promise<Array<{ id: string; workoutDate: Date }>> {
    const rows = await this.db
      .select({ id: workouts.id, workoutDate: workouts.workoutDate })
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'completed')),
      )
      .orderBy(asc(workouts.workoutDate));
    return rows;
  }
}

/** YYYY-MM-DD key in UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}
