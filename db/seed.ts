// db/seed.ts
//
// Seeds the canonical reference data (ADR-003) into local.db using the
// typed Drizzle client (no raw SQL) per story-1.2 AC-1.2-03.
//
// Counts (per docs/architecture/database-schema.md):
//   - 32 exercises
//   - 2 routines (hombre / mujer)
//   - 10 routine_days (5 male + 5 female)
//   - 56 routine_exercises (per day, see ROUTINE_EXERCISES below)
//
// Idempotency: this script uses `db.insert(...).values(...)` which will
// fail on duplicate unique keys. Run only on a fresh DB or after wiping
// the relevant tables. For dev, prefer `npm run db:migrate` first then
// `npm run db:seed`.

import { db } from '../src/lib/db/client';
import {
  exercises,
  routines,
  routineDays,
  routineExercises,
  type NewExercise,
  type NewRoutine,
  type NewRoutineDay,
  type NewRoutineExercise,
} from './schema';

// 32 exercises grouped by muscle (matches database-schema.md § Exercises).
const EXERCISES: NewExercise[] = [
  // chest (7)
  { name: 'Bench Press', muscleGroup: 'chest' },
  { name: 'Incline Press', muscleGroup: 'chest' },
  { name: 'Incline Bench Press', muscleGroup: 'chest' },
  { name: 'Chest Press Machine', muscleGroup: 'chest' },
  { name: 'Chest Press', muscleGroup: 'chest' },
  { name: 'Pec Deck', muscleGroup: 'chest' },
  { name: 'Cable Crossover', muscleGroup: 'chest' },
  // shoulders (2)
  { name: 'Shoulder Press', muscleGroup: 'shoulders' },
  { name: 'Lateral Raises', muscleGroup: 'shoulders' },
  // triceps (3)
  { name: 'Tricep Pulldown', muscleGroup: 'triceps' },
  { name: 'Overhead Tricep Extension', muscleGroup: 'triceps' },
  { name: 'Tricep Extension', muscleGroup: 'triceps' },
  // back (4)
  { name: 'Lat Pulldown', muscleGroup: 'back' },
  { name: 'Row', muscleGroup: 'back' },
  { name: 'Pullover', muscleGroup: 'back' },
  { name: 'Seated Row', muscleGroup: 'back' },
  // biceps (3)
  { name: 'Barbell Bicep Curl', muscleGroup: 'biceps' },
  { name: 'Hammer Curl', muscleGroup: 'biceps' },
  { name: 'Bicep Curl', muscleGroup: 'biceps' },
  // core (1)
  { name: 'Crunches', muscleGroup: 'core' },
  // quads (4)
  { name: 'Squat', muscleGroup: 'quads' },
  { name: 'Leg Press', muscleGroup: 'quads' },
  { name: 'Leg Extension', muscleGroup: 'quads' },
  { name: 'Bulgarian Squat', muscleGroup: 'quads' },
  // legs (3)
  { name: 'Adductors', muscleGroup: 'legs' },
  { name: 'Abductors', muscleGroup: 'legs' },
  { name: 'Calves', muscleGroup: 'legs' },
  { name: 'Lunges', muscleGroup: 'legs' },
  // hamstrings (2)
  { name: 'Romanian Deadlift', muscleGroup: 'hamstrings' },
  { name: 'Leg Curl', muscleGroup: 'hamstrings' },
  // glutes (2)
  { name: 'Hip Thrust', muscleGroup: 'glutes' },
  { name: 'Cable Kickback', muscleGroup: 'glutes' },
];

const ROUTINES: NewRoutine[] = [
  { name: 'Male Routine', type: 'hombre' },
  { name: 'Female Routine', type: 'mujer' },
];

const ROUTINE_DAYS_HOMBRE: Omit<NewRoutineDay, 'routineId'>[] = [
  { dayNumber: 1, dayName: 'Monday', focus: 'Chest + Shoulders + Triceps' },
  { dayNumber: 2, dayName: 'Tuesday', focus: 'Back + Biceps' },
  { dayNumber: 3, dayName: 'Wednesday', focus: 'Chest + Triceps + Biceps' },
  { dayNumber: 4, dayName: 'Thursday', focus: 'Quads + Adductors' },
  { dayNumber: 5, dayName: 'Friday', focus: 'Glutes + Hamstrings' },
];

const ROUTINE_DAYS_MUJER: Omit<NewRoutineDay, 'routineId'>[] = [
  { dayNumber: 1, dayName: 'Monday', focus: 'Glutes + Quads' },
  { dayNumber: 2, dayName: 'Tuesday', focus: 'Back + Biceps' },
  { dayNumber: 3, dayName: 'Wednesday', focus: 'Glutes + Hamstrings' },
  { dayNumber: 4, dayName: 'Thursday', focus: 'Chest + Shoulders + Triceps' },
  { dayNumber: 5, dayName: 'Friday', focus: 'Glutes + Legs' },
];

type ExerciseSlot = readonly [name: string, order: number];

/**
 * Exercise lists per day for each routine. Each entry is
 * [exerciseName, exerciseOrder] — Drizzle inserts the id via the
 * Drizzle client after we resolve name → id.
 */
const ROUTINE_EXERCISES_HOMBRE: ReadonlyMap<number, ReadonlyArray<ExerciseSlot>> =
  new Map([
    [
      1,
      [
        ['Bench Press', 1],
        ['Incline Press', 2],
        ['Pec Deck', 3],
        ['Shoulder Press', 4],
        ['Lateral Raises', 5],
        ['Tricep Pulldown', 6],
        ['Overhead Tricep Extension', 7],
      ],
    ],
    [
      2,
      [
        ['Lat Pulldown', 1],
        ['Row', 2],
        ['Pullover', 3],
        ['Seated Row', 4],
        ['Barbell Bicep Curl', 5],
        ['Hammer Curl', 6],
        ['Crunches', 7],
      ],
    ],
    [
      3,
      [
        ['Incline Bench Press', 1],
        ['Chest Press Machine', 2],
        ['Cable Crossover', 3],
        ['Tricep Pulldown', 4],
        ['Tricep Extension', 5],
        ['Bicep Curl', 6],
      ],
    ],
    [
      4,
      [
        ['Squat', 1],
        ['Leg Press', 2],
        ['Leg Extension', 3],
        ['Adductors', 4],
        ['Calves', 5],
      ],
    ],
    [
      5,
      [
        ['Romanian Deadlift', 1],
        ['Leg Curl', 2],
        ['Hip Thrust', 3],
        ['Lunges', 4],
        ['Calves', 5],
        ['Crunches', 6],
      ],
    ],
  ]);

const ROUTINE_EXERCISES_MUJER: ReadonlyMap<number, ReadonlyArray<ExerciseSlot>> =
  new Map([
    [
      1,
      [
        ['Hip Thrust', 1],
        ['Squat', 2],
        ['Leg Press', 3],
        ['Leg Extension', 4],
        ['Abductors', 5],
      ],
    ],
    [
      2,
      [
        ['Lat Pulldown', 1],
        ['Row', 2],
        ['Pullover', 3],
        ['Bicep Curl', 4],
        ['Crunches', 5],
      ],
    ],
    [
      3,
      [
        ['Romanian Deadlift', 1],
        ['Leg Curl', 2],
        ['Hip Thrust', 3],
        ['Cable Kickback', 4],
        ['Abductors', 5],
      ],
    ],
    [
      4,
      [
        ['Chest Press', 1],
        ['Shoulder Press', 2],
        ['Lateral Raises', 3],
        ['Tricep Pulldown', 4],
      ],
    ],
    [
      5,
      [
        ['Hip Thrust', 1],
        ['Bulgarian Squat', 2],
        ['Lunges', 3],
        ['Abductors', 4],
        ['Calves', 5],
        ['Crunches', 6],
      ],
    ],
  ]);

async function seedExercises(): Promise<Map<string, string>> {
  const inserted = await db.insert(exercises).values(EXERCISES).returning();
  if (inserted.length !== EXERCISES.length) {
    throw new Error(
      `Expected to insert ${EXERCISES.length} exercises, got ${inserted.length}`,
    );
  }
  return new Map(inserted.map((row) => [row.name, row.id]));
}

async function seedRoutines(): Promise<{ hombre: string; mujer: string }> {
  const inserted = await db.insert(routines).values(ROUTINES).returning();
  const hombre = inserted.find((r) => r.type === 'hombre');
  const mujer = inserted.find((r) => r.type === 'mujer');
  if (!hombre || !mujer) {
    throw new Error('Failed to insert both routines (hombre/mujer).');
  }
  return { hombre: hombre.id, mujer: mujer.id };
}

async function seedRoutineDays(
  routineId: string,
  days: ReadonlyArray<Omit<NewRoutineDay, 'routineId'>>,
): Promise<Map<number, string>> {
  const values = days.map((d) => ({ ...d, routineId }));
  const inserted = await db.insert(routineDays).values(values).returning();
  return new Map(inserted.map((row) => [row.dayNumber, row.id]));
}

async function seedRoutineExercises(
  dayIdByDayNumber: ReadonlyMap<number, string>,
  slotsByDayNumber: ReadonlyMap<number, ReadonlyArray<ExerciseSlot>>,
  exerciseIdByName: ReadonlyMap<string, string>,
): Promise<void> {
  const inserts: NewRoutineExercise[] = [];
  for (const [dayNumber, slots] of slotsByDayNumber) {
    const dayId = dayIdByDayNumber.get(dayNumber);
    if (!dayId) {
      throw new Error(`Missing routine_day for day_number=${dayNumber}`);
    }
    for (const [name, order] of slots) {
      const exerciseId = exerciseIdByName.get(name);
      if (!exerciseId) {
        throw new Error(
          `Missing exercise "${name}" referenced in routine day ${dayNumber}`,
        );
      }
      inserts.push({
        routineDayId: dayId,
        exerciseId,
        targetSets: 4,
        targetReps: 10,
        exerciseOrder: order,
      });
    }
  }
  if (inserts.length === 0) return;
  await db.insert(routineExercises).values(inserts);
}

async function main(): Promise<void> {
  // Guard: refuse to run if data already exists.
  const existingExercises = await db.select().from(exercises).limit(1);
  if (existingExercises.length > 0) {
    throw new Error(
      'Refusing to seed: exercises table is not empty. ' +
        'Wipe the DB or run migrations on a fresh database first.',
    );
  }

  console.log('Seeding exercises...');
  const exerciseIdByName = await seedExercises();
  console.log(`  ✓ ${EXERCISES.length} exercises inserted`);

  console.log('Seeding routines...');
  const routineIds = await seedRoutines();
  console.log(`  ✓ ${ROUTINES.length} routines inserted`);

  console.log('Seeding routine_days (hombre)...');
  const hombreDayIds = await seedRoutineDays(
    routineIds.hombre,
    ROUTINE_DAYS_HOMBRE,
  );
  console.log(`  ✓ ${ROUTINE_DAYS_HOMBRE.length} days`);

  console.log('Seeding routine_days (mujer)...');
  const mujerDayIds = await seedRoutineDays(
    routineIds.mujer,
    ROUTINE_DAYS_MUJER,
  );
  console.log(`  ✓ ${ROUTINE_DAYS_MUJER.length} days`);

  console.log('Seeding routine_exercises (hombre)...');
  await seedRoutineExercises(
    hombreDayIds,
    ROUTINE_EXERCISES_HOMBRE,
    exerciseIdByName,
  );
  const hombreCount = [...ROUTINE_EXERCISES_HOMBRE.values()].reduce(
    (sum, slots) => sum + slots.length,
    0,
  );
  console.log(`  ✓ ${hombreCount} routine_exercises`);

  console.log('Seeding routine_exercises (mujer)...');
  await seedRoutineExercises(
    mujerDayIds,
    ROUTINE_EXERCISES_MUJER,
    exerciseIdByName,
  );
  const mujerCount = [...ROUTINE_EXERCISES_MUJER.values()].reduce(
    (sum, slots) => sum + slots.length,
    0,
  );
  console.log(`  ✓ ${mujerCount} routine_exercises`);

  console.log('Done.');
}

// Top-level await is allowed because tsconfig has NodeNext with .ts.
main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
