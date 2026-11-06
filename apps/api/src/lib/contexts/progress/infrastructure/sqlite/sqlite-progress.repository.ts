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
import { profiles, routineDays, routineDayWeekdays, workoutEntries, workouts } from '@db/schema';
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
      .select({ id: workouts.id, workoutDate: workouts.workoutDate })
      .from(workouts)
      .where(
        and(eq(workouts.userId, userId), eq(workouts.status, 'completed')),
      )
      .orderBy(asc(workouts.workoutDate));

    // Date → workout id; the latest one of a day wins.
    const workoutDates = new Map(
      dateRows.map((r) => [toDateKey(r.workoutDate), r.id] as const),
    );

    // Generate the last N calendar days ending today (UTC).
    return lastNDateKeys(days).map((date) => ({
      date,
      hasWorkout: workoutDates.has(date),
      workoutId: workoutDates.get(date),
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
    const restDays = await this.getPlannedRestDays(userId);
    const today = startOfTodayUtc();
    const yesterday = new Date(today.getTime() - 86_400_000);

    // Planned rest days are neutral; a missed planned training day breaks the streak.
    let cursor = today;
    if (!dateSet.has(toDateKey(today)) && !restDays.has(today.getUTCDay())) {
      if (dateSet.has(toDateKey(yesterday))) {
        cursor = yesterday;
      } else {
        return { current: 0, total };
      }
    }

    let current = 0;
    while (true) {
      if (dateSet.has(toDateKey(cursor))) {
        current++;
      } else if (!restDays.has(cursor.getUTCDay())) {
        break;
      }
      cursor = new Date(cursor.getTime() - 86_400_000);
    }
    return { current, total };
  }

  /** Weekdays omitted from the active program schedule are planned rest days. */
  private async getPlannedRestDays(userId: string): Promise<Set<number>> {
    const profileRows = await this.db
      .select({ activeProgramId: profiles.activeProgramId })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    const programId = profileRows[0]?.activeProgramId;
    if (!programId) return new Set();

    const [legacyRows, weekdayRows] = await Promise.all([this.db
      .select({ weekday: routineDays.weekday })
      .from(routineDays)
      .where(eq(routineDays.routineId, programId)), this.db
      .select({ weekday: routineDayWeekdays.weekday })
      .from(routineDayWeekdays)
      .innerJoin(routineDays, eq(routineDays.id, routineDayWeekdays.routineDayId))
      .where(eq(routineDays.routineId, programId))]);
    const plannedDays = new Set([...legacyRows.flatMap((row) => row.weekday === null ? [] : [row.weekday]), ...weekdayRows.map((row) => row.weekday)]);
    if (plannedDays.size === 0) return new Set();

    return new Set([0, 1, 2, 3, 4, 5, 6].filter((day) => !plannedDays.has(day)));
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
