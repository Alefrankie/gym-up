// src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts
//
// Use case: compute the dashboard view state for the current user.
//
// Per docs/architecture/contexts/workout-tracking/readme.md Use Cases table
// (GetTodayWorkoutUseCase — was "planned", now implemented for story 2.1).
// Per docs/architecture/contexts/workout-tracking/flows/start-workout.flow.md
// (Steps 1-3 of the happy path; Step 4 = 2.2 handoff).
//
// Returns a discriminated union so the page can render exactly one of three
// states without leaking repository details to the Astro template:
//   - no_routine  → user has no routine assigned (defensive — schema is NOT NULL)
//   - rest_day    → today is weekend, user must pick a day (1-5) manually
//   - workout_day → render the routine + CTA (Start / Continue / Ver resumen)

import type { RoutineDay, RoutineExercise, Exercise, Workout } from '@db/schema';
import type { RoutineRepository } from '../domain/routine.repository';
import type { WorkoutRepository } from '../domain/workout.repository';

export type WeightUnit = 'kg' | 'lbs';
export type RoutineKind = 'hombre' | 'mujer';
export type WorkoutStatusView = 'not_started' | 'in_progress' | 'completed';

export interface GetTodayWorkoutInput {
  userId: string;
  routineType: RoutineKind | null;
  weightUnit: WeightUnit;
  /**
   * Optional manual day pick (1-5). Used by the weekend rest-day picker
   * via the `?day=N` query param. Invalid values (out of range, NaN,
   * non-integer) are ignored — the use case falls back to today's weekday
   * (or day 1 if today is also weekend, matching AC-2.1-07).
   */
  dayOverride?: number;
  /**
   * Injectable "now" — used by tests to make weekday math deterministic.
   * Production callers should leave this unset.
   */
  now?: Date;
}

export type GetTodayWorkoutResult =
  | {
      kind: 'no_routine';
    }
  | {
      kind: 'rest_day';
      dayOptions: ReadonlyArray<{
        dayNumber: number;
        dayName: string;
        focus: string;
      }>;
      weightUnit: WeightUnit;
    }
  | {
      kind: 'workout_day';
      routineDay: RoutineDay;
      exercises: ReadonlyArray<RoutineExercise & { exercise: Exercise }>;
      workoutStatus: WorkoutStatusView;
      existingWorkoutId: string | null;
      weightUnit: WeightUnit;
      dayNumber: number;
    };

const VALID_DAY_MIN = 1;
const VALID_DAY_MAX = 5;
const JS_SUNDAY = 0;
const JS_SATURDAY = 6;
const ISO_SUNDAY = 7;

function mapJsDayToIsoWeekday(jsDay: number): number {
  // JS: 0=Sun..6=Sat. ISO weekday: 1=Mon..7=Sun.
  return jsDay === JS_SUNDAY ? ISO_SUNDAY : jsDay;
}

function isValidDayOverride(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= VALID_DAY_MIN &&
    value <= VALID_DAY_MAX
  );
}

function mapWorkoutStatus(workout: Workout | undefined): WorkoutStatusView {
  if (!workout) return 'not_started';
  if (workout.status === 'completed') return 'completed';
  if (workout.status === 'in_progress') return 'in_progress';
  return 'not_started';
}

export class GetTodayWorkoutUseCase {
  constructor(
    private readonly routineRepository: RoutineRepository,
    private readonly workoutRepository: WorkoutRepository,
  ) {}

  async execute(input: GetTodayWorkoutInput): Promise<GetTodayWorkoutResult> {
    if (input.routineType === null) {
      return { kind: 'no_routine' };
    }

    const now = input.now ?? new Date();
    const jsDay = now.getDay();
    const isoWeekday = mapJsDayToIsoWeekday(jsDay);
    const isWeekend = isoWeekday >= 6;

    // Resolve the effective day number:
    //   1. Valid dayOverride (1-5) wins → use it (user picked a day on weekend,
    //      or forced a different day on weekday).
    //   2. Invalid dayOverride → fall back to day 1 (Monday) per AC-2.1-07.
    //   3. No override → use today's weekday, OR null (rest_day) on weekend.
    let effectiveDayNumber: number | null;
    if (isValidDayOverride(input.dayOverride)) {
      effectiveDayNumber = input.dayOverride;
    } else if (input.dayOverride !== undefined) {
      effectiveDayNumber = 1;
    } else {
      effectiveDayNumber = isWeekend ? null : isoWeekday;
    }

    // Weekend + no override → rest day with picker options.
    if (effectiveDayNumber === null) {
      const dayOptions = await this.fetchDayOptions(input.routineType);
      return { kind: 'rest_day', dayOptions, weightUnit: input.weightUnit };
    }

    // Fetch the routine day for the effective day.
    const routineDay = await this.routineRepository.findDayByTypeAndDayNumber(
      input.routineType,
      effectiveDayNumber,
    );
    if (!routineDay) {
      // Override 1-5 with missing DB row = data integrity bug. Throw so the
      // bug surfaces in logs (not silently masked as rest_day).
      throw new Error(
        `Routine data missing for type=${input.routineType} dayNumber=${effectiveDayNumber}`,
      );
    }

    const dayWithExercises = await this.routineRepository.findDayWithExercises(
      routineDay.id,
    );
    const existingWorkout = await this.workoutRepository.findByUserAndDate(
      input.userId,
      now,
    );

    return {
      kind: 'workout_day',
      routineDay,
      exercises: dayWithExercises?.exercises ?? [],
      workoutStatus: mapWorkoutStatus(existingWorkout),
      existingWorkoutId: existingWorkout?.id ?? null,
      weightUnit: input.weightUnit,
      dayNumber: effectiveDayNumber,
    };
  }

  /**
   * Build the rest-day picker's option list by fetching each of days 1-5.
   * Days that are missing in the DB are simply omitted (defensive — should
   * not happen with the canonical seed, but the picker shouldn't crash on
   * partial data either).
   */
  private async fetchDayOptions(
    type: RoutineKind,
  ): Promise<ReadonlyArray<{ dayNumber: number; dayName: string; focus: string }>> {
    const options: Array<{ dayNumber: number; dayName: string; focus: string }> = [];
    for (let dayNumber = VALID_DAY_MIN; dayNumber <= VALID_DAY_MAX; dayNumber++) {
      const day = await this.routineRepository.findDayByTypeAndDayNumber(
        type,
        dayNumber,
      );
      if (day) {
        options.push({
          dayNumber: day.dayNumber,
          dayName: day.dayName,
          focus: day.focus,
        });
      }
    }
    return options;
  }
}
