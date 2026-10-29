// src/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository.ts
//
// SQLite-backed implementation of ProgressRepository.
//
// Per ADR-007 + ADR-011: implements the abstract port, consumes the Drizzle `db`.
// Per ADR-004 (read-all on workouts / workout_entries): no ownership guard —
// the use-case layer enforces the userId scope.
// Per ADR-006: weights are returned in KG. No conversion here.
// Per golden-rules (Cross-Context Isolation): reads from the same tables
// as workout-tracking but does NOT import any workout-tracking repository.

import { and, asc, eq, gte } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { workoutEntries, workouts } from '@db/schema';
import type { CalendarDay, Streak } from '../../domain/progress.types';
import {
  type ProgressRepository,
  type RawEntry,
} from '../../domain/ports/ProgressRepository';

export class SqliteProgressRepository implements ProgressRepository {
  constructor(private readonly db: Db) {}

  async getExerciseHistory(
    userId: string,
    exerciseId: string,
    since: Date | null,
  ): Promise<RawEntry[]> {
    const rows = await this.db
      .select({
        workoutDate: workouts.workoutDate,
        reps: workoutEntries.reps,
        weight: workoutEntries.weight,
      })
      .from(workoutEntries)
      .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workouts.status, 'completed'),
          eq(workoutEntries.exerciseId, exerciseId),
          eq(workoutEntries.completed, true),
          since ? gte(workouts.workoutDate, since) : undefined,
        ),
      )
      .orderBy(asc(workouts.workoutDate));
    return rows;
  }

  async getCalendarData(userId: string, days: number): Promise<CalendarDay[]> {
    // Pull all distinct completed workout dates for the user.
    const dateRows = await this.db
      .selectDistinct({ workoutDate: workouts.workoutDate })
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'completed')),
      );

    const workoutDates = new Set(
      dateRows.map((r) => toDateKey(r.workoutDate)),
    );

    // Generate the last N calendar days ending today (UTC).
    return lastNDateKeys(days).map((date) => ({
      date,
      hasWorkout: workoutDates.has(date),
    }));
  }

  async getStreak(userId: string): Promise<Streak> {
    const dateRows = await this.db
      .selectDistinct({ workoutDate: workouts.workoutDate })
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'completed')),
      )
      .orderBy(asc(workouts.workoutDate));

    const dates = dateRows.map((r) => toDateKey(r.workoutDate));
    const total = dates.length;

    if (total === 0) {
      return { current: 0, total: 0 };
    }

    const dateSet = new Set(dates);
    const today = startOfTodayUtc();
    const yesterday = new Date(today.getTime() - 86_400_000);

    // Streak counts back from today (or yesterday if no workout today).
    let cursor: Date | null = null;
    if (dateSet.has(toDateKey(today))) {
      cursor = today;
    } else if (dateSet.has(toDateKey(yesterday))) {
      cursor = yesterday;
    }
    if (cursor === null) {
      return { current: 0, total };
    }

    let current = 0;
    while (dateSet.has(toDateKey(cursor))) {
      current++;
      cursor = new Date(cursor.getTime() - 86_400_000);
    }
    return { current, total };
  }
}

// ---------- local helpers ----------

/** YYYY-MM-DD key in UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Midnight UTC of the current calendar day. */
function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Build the most-recent N date keys (oldest first → today last), in UTC.
 * E.g. lastNDateKeys(3) when today is 2026-08-04 →
 *   ['2026-08-02', '2026-08-03', '2026-08-04']
 */
function lastNDateKeys(n: number): string[] {
  const today = startOfTodayUtc();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(toDateKey(new Date(today.getTime() - i * 86_400_000)));
  }
  return out;
}
