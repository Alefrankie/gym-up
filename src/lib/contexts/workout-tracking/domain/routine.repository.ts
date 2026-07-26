// src/lib/contexts/workout-tracking/domain/routine.repository.ts
//
// Abstract contract for routine aggregate persistence.
//
// Per ADR-007 + ADR-011: concrete classes `implements` this abstract
// class; they do not `extend` it. The routine is the aggregate root
// (routines + routine_days + routine_exercises) per Alefrank's decision
// in story 1.2 — one repository manages the whole aggregate.

import type {
  Routine,
  RoutineDay,
  RoutineExercise,
  Exercise,
} from '@db/schema';

export interface RoutineDayWithExercises {
  day: RoutineDay;
  exercises: Array<RoutineExercise & { exercise: Exercise }>;
}

/**
 * Routine aggregate root. Routines are global (not per-user); read-only at
 * runtime (seed data per ADR-003). Writes (CRUD) are not exposed on the
 * abstract — seed is the only writer in Round 1.
 */
export abstract class RoutineRepository {
  /**
   * List all routines (hombre + mujer). Read-only.
   */
  abstract findAll(): Promise<Routine[]>;

  /**
   * Look up a routine by id. Returns `undefined` if not found.
   */
  abstract findById(id: string): Promise<Routine | undefined>;

  /**
   * Find the routine_day for a given (type, dayNumber) combination —
   * primary access pattern from `start-workout.flow.md` step 2.
   */
  abstract findDayByTypeAndDayNumber(
    type: 'hombre' | 'mujer',
    dayNumber: number,
  ): Promise<RoutineDay | undefined>;

  /**
   * Load a routine day along with its exercise slots and exercise
   * metadata. Used to render the workout page (start-workout flow).
   */
  abstract findDayWithExercises(
    dayId: string,
  ): Promise<RoutineDayWithExercises | undefined>;
}
