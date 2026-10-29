// src/lib/contexts/progress/infrastructure/sqlite/sqlite-exercise-query.repository.ts
//
// SQLite-backed implementation of ExerciseQueryRepository.
//
// Per ADR-007 + ADR-011: implements the abstract port.
// Per architecture invariant: "Exercise selector shows ONLY exercises the
// user has actually logged" → query JOINs through workout_entries filtered
// by userId + status='completed' + completed=true.
// Per golden-rules (Cross-Context Isolation): queries the `exercises` table
// directly. Does NOT import any workout-tracking repository.

import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { exercises, workoutEntries, workouts, type Exercise } from '@db/schema';
import { ExerciseQueryRepository } from '../../domain/ports/ExerciseQueryRepository';

export class SqliteExerciseQueryRepository implements ExerciseQueryRepository {
  constructor(private readonly db: Db) {}

  async getLoggedExercises(userId: string): Promise<Exercise[]> {
    return this.db
      .selectDistinct({
        id: exercises.id,
        name: exercises.name,
        muscleGroup: exercises.muscleGroup,
      })
      .from(exercises)
      .innerJoin(workoutEntries, eq(workoutEntries.exerciseId, exercises.id))
      .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workouts.status, 'completed'),
          eq(workoutEntries.completed, true),
        ),
      )
      .orderBy(asc(exercises.name));
  }
}
