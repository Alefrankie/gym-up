// src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts
//
// SQLite-backed implementation of WorkoutRepository.
//
// Per ADR-004 (write-own / read-all): `update`, `delete`, and `addEntry`
// enforce that the workout's userId matches `currentUserId`. Reads
// (find*) do not filter.
// Per ADR-006: `addEntry` does NOT convert weight — callers (UI layer)
// pass kg already. The repo stores kg.
// Per ADR-007 + ADR-012: consumes the Drizzle `db` instance.
// Per ADR-011: `implements`, not `extends`.

import { and, asc, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  exercises,
  routineDays,
  workoutEntries,
  workouts,
  type NewWorkout,
  type NewWorkoutEntry,
  type Workout,
  type WorkoutEntry,
} from '@db/schema';
import {
  WorkoutOwnershipError,
  WorkoutRepository,
  type WorkoutDetailEntry,
  type WorkoutEntryPatch,
  type WorkoutHistoryItem,
  type WorkoutUpdate,
} from '@/lib/contexts/workout-tracking/domain/workout.repository';

export class SqliteWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Workout | undefined> {
    const rows = await this.db
      .select()
      .from(workouts)
      .where(eq(workouts.id, id))
      .limit(1);
    return rows[0];
  }

  async findByUserAndDate(
    userId: string,
    date: Date,
  ): Promise<Workout | undefined> {
    // Match the full calendar day in UTC. `workout_date` is stored as
    // ms-since-epoch (Drizzle `timestamp_ms`).
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const rows = await this.db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.workoutDate, startOfDay),
          lt(workouts.workoutDate, endOfDay),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findInProgressByUser(userId: string): Promise<Workout | undefined> {
    const rows = await this.db
      .select()
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'in_progress')),
      )
      .limit(1);
    return rows[0];
  }

  async create(input: NewWorkout): Promise<Workout> {
    const rows = await this.db.insert(workouts).values(input).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to insert workout: no row returned.');
    }
    return row;
  }

  async update(
    id: string,
    patch: WorkoutUpdate,
    currentUserId: string,
  ): Promise<Workout> {
    // Ownership guard: read first, then update atomically.
    // (A single UPDATE...WHERE userId=... would be cleaner but Drizzle's
    // returning() doesn't tell us whether the row existed vs. didn't
    // match the ownership filter — explicit check is clearer.)
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Workout not found: ${id}`);
    }
    if (existing.userId !== currentUserId) {
      throw new WorkoutOwnershipError(id, currentUserId);
    }

    const rows = await this.db
      .update(workouts)
      .set(patch)
      .where(eq(workouts.id, id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error(`Workout ${id} disappeared during update.`);
    }
    return row;
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Workout not found: ${id}`);
    }
    if (existing.userId !== currentUserId) {
      throw new WorkoutOwnershipError(id, currentUserId);
    }
    await this.db.delete(workouts).where(eq(workouts.id, id));
  }

  async addEntry(
    workoutId: string,
    input: Omit<NewWorkoutEntry, 'workoutId'>,
    currentUserId: string,
  ): Promise<WorkoutEntry> {
    const workout = await this.findById(workoutId);
    if (!workout) {
      throw new Error(`Workout not found: ${workoutId}`);
    }
    if (workout.userId !== currentUserId) {
      throw new WorkoutOwnershipError(workoutId, currentUserId);
    }
    // Force the FK to the workout; ignore any workoutId in `input` to
    // prevent call-site injection.
    const rows = await this.db
      .insert(workoutEntries)
      .values({ ...input, workoutId })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to insert workout_entry: no row returned.');
    }
    return row;
  }

  async findEntries(workoutId: string): Promise<WorkoutEntry[]> {
    return this.db
      .select()
      .from(workoutEntries)
      .where(eq(workoutEntries.workoutId, workoutId))
      .orderBy(
        asc(workoutEntries.exerciseId),
        asc(workoutEntries.setNumber),
      );
  }

  async updateEntry(
    id: string,
    patch: WorkoutEntryPatch,
    currentUserId: string,
  ): Promise<WorkoutEntry> {
    // 1. Find the entry to get the workoutId for the ownership check.
    const entryRows = await this.db
      .select()
      .from(workoutEntries)
      .where(eq(workoutEntries.id, id))
      .limit(1);
    const existing = entryRows[0];
    if (!existing) {
      throw new Error(`Workout entry not found: ${id}`);
    }

    // 2. Verify ownership of the parent workout.
    const workout = await this.findById(existing.workoutId);
    if (!workout) {
      throw new Error(`Workout not found: ${existing.workoutId}`);
    }
    if (workout.userId !== currentUserId) {
      throw new WorkoutOwnershipError(existing.workoutId, currentUserId);
    }

    // 3. Apply the patch.
    const updatedRows = await this.db
      .update(workoutEntries)
      .set(patch)
      .where(eq(workoutEntries.id, id))
      .returning();
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error(`Workout entry ${id} disappeared during update.`);
    }
    return updated;
  }

  async getHistoryByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<WorkoutHistoryItem[]> {
    // One query: JOIN routine_days for the day name, aggregate over
    // workout_entries for exercise count + total volume. Filters by
    // userId (read-own) and orders by workout_date DESC.
    //
    // Volume = Σ(reps × weight) for completed entries only — matches
    // workout-summary.astro per Q4 user decision.
    const rows = await this.db
      .select({
        id: workouts.id,
        workoutDate: workouts.workoutDate,
        status: workouts.status,
        routineDayName: routineDays.dayName,
        exerciseCount: sql<number>`COUNT(DISTINCT ${workoutEntries.exerciseId})`,
        totalVolume: sql<number>`COALESCE(SUM(CASE WHEN ${workoutEntries.completed} = 1 THEN ${workoutEntries.reps} * ${workoutEntries.weight} ELSE 0 END), 0)`,
      })
      .from(workouts)
      .innerJoin(routineDays, eq(routineDays.id, workouts.routineDayId))
      .leftJoin(
        workoutEntries,
        eq(workoutEntries.workoutId, workouts.id),
      )
      .where(eq(workouts.userId, userId))
      .groupBy(workouts.id, routineDays.dayName)
      .orderBy(desc(workouts.workoutDate))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      workoutDate: row.workoutDate,
      routineDayName: row.routineDayName,
      exerciseCount: Number(row.exerciseCount),
      totalVolume: Number(row.totalVolume),
      status: row.status,
    }));
  }

  async getHistoryCountByUser(userId: string): Promise<number> {
    const rows = await this.db
      .select({ count: count() })
      .from(workouts)
      .where(eq(workouts.userId, userId));
    return rows[0]?.count ?? 0;
  }

  async getEntriesWithExercises(
    workoutId: string,
  ): Promise<WorkoutDetailEntry[]> {
    // JOIN workout_entries with exercises to return denormalized rows
    // with exerciseName + muscleGroup. Ordered by (exercise_id, set_number)
    // — same as findEntries.
    const rows = await this.db
      .select({
        id: workoutEntries.id,
        exerciseId: workoutEntries.exerciseId,
        exerciseName: exercises.name,
        muscleGroup: exercises.muscleGroup,
        setNumber: workoutEntries.setNumber,
        reps: workoutEntries.reps,
        weight: workoutEntries.weight,
        completed: workoutEntries.completed,
        notes: workoutEntries.notes,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
      .where(eq(workoutEntries.workoutId, workoutId))
      .orderBy(
        asc(workoutEntries.exerciseId),
        asc(workoutEntries.setNumber),
      );

    return rows.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      muscleGroup: row.muscleGroup,
      setNumber: row.setNumber,
      reps: row.reps,
      weight: row.weight,
      completed: row.completed,
      notes: row.notes,
    }));
  }
}
