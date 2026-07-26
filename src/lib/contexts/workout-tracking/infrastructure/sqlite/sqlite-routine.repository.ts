// src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository.ts
//
// SQLite-backed implementation of RoutineRepository (aggregate root).
//
// Per ADR-007 + ADR-012: consumes the Drizzle `db` instance.
// Per ADR-011: `implements`, not `extends`.
// Routines are seed data (ADR-003) — read-only at runtime in Round 1.

import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  exercises,
  routineDays,
  routineExercises,
  routines,
  type Routine,
  type RoutineDay,
} from '@db/schema';
import {
  RoutineRepository,
  type RoutineDayWithExercises,
} from '@/lib/contexts/workout-tracking/domain/routine.repository';

export class SqliteRoutineRepository implements RoutineRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<Routine[]> {
    return this.db.select().from(routines).orderBy(asc(routines.type));
  }

  async findById(id: string): Promise<Routine | undefined> {
    const rows = await this.db.select().from(routines).where(eq(routines.id, id)).limit(1);
    return rows[0];
  }

  async findDayByTypeAndDayNumber(
    type: 'hombre' | 'mujer',
    dayNumber: number,
  ): Promise<RoutineDay | undefined> {
    const rows = await this.db
      .select({ day: routineDays })
      .from(routineDays)
      .innerJoin(routines, eq(routineDays.routineId, routines.id))
      .where(and(eq(routines.type, type), eq(routineDays.dayNumber, dayNumber)))
      .limit(1);
    return rows[0]?.day;
  }

  async findDayWithExercises(
    dayId: string,
  ): Promise<RoutineDayWithExercises | undefined> {
    const dayRows = await this.db
      .select()
      .from(routineDays)
      .where(eq(routineDays.id, dayId))
      .limit(1);
    const day = dayRows[0];
    if (!day) return undefined;

    const slots = await this.db
      .select({
        slot: routineExercises,
        exercise: exercises,
      })
      .from(routineExercises)
      .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
      .where(eq(routineExercises.routineDayId, dayId))
      .orderBy(asc(routineExercises.exerciseOrder));

    return {
      day,
      exercises: slots.map((row) => ({ ...row.slot, exercise: row.exercise })),
    };
  }
}
