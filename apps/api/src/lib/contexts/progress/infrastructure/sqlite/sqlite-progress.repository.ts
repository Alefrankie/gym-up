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
import { profiles, routineDays, routineDayWeekdays, streakFreezes, workoutEntries, workouts } from '@db/schema';
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
    const [dateRows, freezeRows, restDays] = await Promise.all([
      this.db
        .selectDistinct({ workoutDate: workouts.workoutDate })
        .from(workouts)
        .where(and(eq(workouts.userId, userId), eq(workouts.status, 'completed')))
        .orderBy(asc(workouts.workoutDate)),
      this.db.select({ day: streakFreezes.day }).from(streakFreezes).where(eq(streakFreezes.userId, userId)),
      this.getPlannedRestDays(userId),
    ]);

    const dateSet = new Set(dateRows.map((r) => toDateKey(r.workoutDate)));
    const total = dateSet.size;
    const frozen = new Set(freezeRows.map((r) => r.day));
    const frozenDays = [...frozen].sort();
    const today = startOfTodayUtc();
    const yesterday = addDays(today, -1);

    // Planned rest days and frozen days are neutral; a missed planned training day breaks the streak.
    const neutral = (d: Date) => restDays.has(d.getUTCDay()) || frozen.has(toDateKey(d));
    const countFrom = (start: Date) => {
      let n = 0;
      // Neutral days never end the walk alone, so stop once we pass the oldest record.
      const oldest = Math.min(...[...dateSet, ...frozen].map((k) => Date.parse(k)));
      for (let c = start; c.getTime() >= oldest; c = addDays(c, -1)) {
        if (dateSet.has(toDateKey(c))) n++;
        else if (!neutral(c)) break;
      }
      return n;
    };

    let current = 0;
    if (total > 0) {
      if (dateSet.has(toDateKey(today)) || neutral(today)) current = countFrom(today);
      else if (dateSet.has(toDateKey(yesterday)) || neutral(yesterday)) current = countFrom(yesterday);
    }

    // One freeze per ISO week (Mon–Sun) of yesterday, only for a missed training day with a streak to save.
    const monday = addDays(yesterday, -((yesterday.getUTCDay() + 6) % 7));
    const weekUsed = [0, 1, 2, 3, 4, 5, 6].some((i) => frozen.has(toDateKey(addDays(monday, i))));
    const canFreeze =
      !dateSet.has(toDateKey(yesterday)) && !neutral(yesterday) && !weekUsed && countFrom(addDays(yesterday, -1)) > 0;

    return { current, total, canFreeze, frozenDays };
  }

  async addFreeze(userId: string, day: string): Promise<void> {
    await this.db.insert(streakFreezes).values({ userId, day, createdAt: Date.now() }).onConflictDoNothing();
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

/** `d` shifted by whole UTC days. */
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
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
