// db/seed.ts
//
// Seeds the canonical reference data (ADR-003) with the typed Drizzle client
// (no raw SQL) per story-1.2 AC-1.2-03. Use `seedReferenceData(db)` from tests,
// scripts, or a Worker; `db/seed-cli.ts` runs it against a local SQLite file.
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

import type { Db } from '../src/lib/db/client';
import { EXERCISE_CATALOG } from './catalog';
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

// System exercises (catalog in db/catalog.ts, ADR-017).
const EXERCISES: NewExercise[] = EXERCISE_CATALOG.map((e) => ({
  name: e.name,
  muscleGroup: e.primary,
  secondaryMuscles: JSON.stringify(e.secondary),
  equipment: e.equipment,
  exerciseType: e.type,
  instructions: e.instructions ?? null,
}));

const TEMPLATE_BASE = { isTemplate: true, createdAt: 0, updatedAt: 0 } as const;

const ROUTINES: NewRoutine[] = [
  { ...TEMPLATE_BASE, name: 'Male 5-Day Split', type: 'hombre', level: 'intermediate', goal: 'hypertrophy', daysPerWeek: 5, description: 'Cinco días: pecho y hombros, espalda, brazos, piernas y glúteos.' },
  { ...TEMPLATE_BASE, name: 'Female Glute Focus 5-Day', type: 'mujer', level: 'intermediate', goal: 'hypertrophy', daysPerWeek: 5, description: 'Cinco días con énfasis en glúteos y piernas.' },
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

async function seedExercises(db: Db): Promise<Map<string, string>> {
  const inserted = await db.insert(exercises).values(EXERCISES).returning();
  if (inserted.length !== EXERCISES.length) {
    throw new Error(
      `Expected to insert ${EXERCISES.length} exercises, got ${inserted.length}`,
    );
  }
  return new Map(inserted.map((row) => [row.name, row.id]));
}

async function seedRoutines(db: Db): Promise<{ hombre: string; mujer: string }> {
  const inserted = await db.insert(routines).values(ROUTINES).returning();
  const hombre = inserted.find((r) => r.type === 'hombre');
  const mujer = inserted.find((r) => r.type === 'mujer');
  if (!hombre || !mujer) {
    throw new Error('Failed to insert both routines (hombre/mujer).');
  }
  return { hombre: hombre.id, mujer: mujer.id };
}

async function seedRoutineDays(
  db: Db,
  routineId: string,
  days: ReadonlyArray<Omit<NewRoutineDay, 'routineId'>>,
): Promise<Map<number, string>> {
  const values = days.map((d) => ({ ...d, routineId }));
  const inserted = await db.insert(routineDays).values(values).returning();
  return new Map(inserted.map((row) => [row.dayNumber, row.id]));
}

async function seedRoutineExercises(
  db: Db,
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
        targetRepsMin: 10,
        targetRepsMax: 10,
        exerciseOrder: order,
      });
    }
  }
  if (inserts.length === 0) return;
  await db.insert(routineExercises).values(inserts);
}

/** `[name, reps, note]` pins the target reps and adds a note (e.g. the load someone used); a bare name uses 3 x 10. */
type ExtraSlot = string | readonly [name: string, reps: number, note?: string];
type ExtraDay = readonly [dayName: string, focus: string, exercises: readonly ExtraSlot[]];
interface ExtraTemplate {
  name: string;
  description: string;
  level: string;
  goal: string;
  days: readonly ExtraDay[];
}

const EXTRA_TEMPLATES: readonly ExtraTemplate[] = [
  {
    name: 'Lower Body (Gravl)',
    description: 'Pierna del jueves: isquios, glúteos y cuádriceps. Cargas orientativas en las notas.',
    level: 'intermediate',
    goal: 'hypertrophy',
    days: [
      [
        'Lower Body',
        'Isquios + Glúteos + Cuádriceps',
        [
          ['Dumbbell Romanian Deadlift', 12, 'Gravl: 17.5 kg'],
          ['Plate-Loaded Hip Thrust (Belt)', 12, 'Gravl: 80 kg'],
          ['Seated Leg Curl', 10, 'Gravl: 47.7 kg'],
          ['Bulgarian Squat', 10, 'Gravl: 10 kg (mancuerna)'],
          ['Abductors', 10, 'Gravl: 56.8 kg'],
        ],
      ],
    ],
  },
  {
    name: 'Full Body 3-Day',
    description: 'Tres días de cuerpo completo, ideal para empezar.',
    level: 'beginner',
    goal: 'general',
    days: [
      ['Full Body A', 'Pecho + Espalda + Piernas', ['Squat', 'Bench Press', 'Lat Pulldown', 'Shoulder Press', 'Crunches']],
      ['Full Body B', 'Piernas + Hombros + Brazos', ['Romanian Deadlift', 'Incline Press', 'Seated Row', 'Lateral Raises', 'Bicep Curl', 'Tricep Pulldown']],
      ['Full Body C', 'Piernas + Pecho + Espalda', ['Leg Press', 'Chest Press', 'Row', 'Hip Thrust', 'Hammer Curl', 'Crunches']],
    ],
  },
  {
    name: 'Upper / Lower 4-Day',
    description: 'Cuatro días alternando tren superior e inferior.',
    level: 'intermediate',
    goal: 'strength',
    days: [
      ['Upper A', 'Pecho + Espalda + Hombros', ['Bench Press', 'Row', 'Shoulder Press', 'Lat Pulldown', 'Tricep Pulldown', 'Barbell Bicep Curl']],
      ['Lower A', 'Cuádriceps + Femorales', ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calves']],
      ['Upper B', 'Pecho + Espalda + Brazos', ['Incline Bench Press', 'Seated Row', 'Lateral Raises', 'Pullover', 'Overhead Tricep Extension', 'Hammer Curl']],
      ['Lower B', 'Glúteos + Cuádriceps', ['Hip Thrust', 'Bulgarian Squat', 'Leg Extension', 'Lunges', 'Calves', 'Crunches']],
    ],
  },
  {
    name: 'Push / Pull / Legs',
    description: 'Tres días: empuje, tirón y piernas. Repítelos para una semana de seis.',
    level: 'intermediate',
    goal: 'hypertrophy',
    days: [
      ['Push', 'Pecho + Hombros + Tríceps', ['Bench Press', 'Incline Press', 'Pec Deck', 'Shoulder Press', 'Lateral Raises', 'Tricep Pulldown']],
      ['Pull', 'Espalda + Bíceps', ['Lat Pulldown', 'Row', 'Seated Row', 'Pullover', 'Barbell Bicep Curl', 'Hammer Curl']],
      ['Legs', 'Piernas + Glúteos', ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curl', 'Hip Thrust', 'Calves']],
    ],
  },
];

async function seedExtraTemplates(
  db: Db,
  exerciseIdByName: ReadonlyMap<string, string>,
): Promise<void> {
  for (const t of EXTRA_TEMPLATES) {
    const [routine] = await db
      .insert(routines)
      .values({
        ...TEMPLATE_BASE,
        name: t.name,
        type: 'neutral',
        description: t.description,
        level: t.level,
        goal: t.goal,
        daysPerWeek: t.days.length,
      })
      .returning();
    const days = await db
      .insert(routineDays)
      .values(
        t.days.map(([dayName, focus], i) => ({
          routineId: routine!.id,
          dayNumber: i + 1,
          dayName,
          focus,
        })),
      )
      .returning();
    const slots: NewRoutineExercise[] = [];
    t.days.forEach(([, , names], i) => {
      names.forEach((slot, order) => {
        const [name, reps, note] = typeof slot === 'string' ? [slot, 10, undefined] : slot;
        const exerciseId = exerciseIdByName.get(name);
        if (!exerciseId) throw new Error(`Missing exercise "${name}" in template ${t.name}`);
        slots.push({
          routineDayId: days[i]!.id,
          exerciseId,
          targetSets: 3,
          targetReps: reps,
          targetRepsMin: reps,
          targetRepsMax: reps,
          notes: note ?? null,
          exerciseOrder: order + 1,
        });
      });
    });
    await db.insert(routineExercises).values(slots);
  }
}

/**
 * Seeds the canonical reference data into any SQLite-dialect Drizzle database
 * (local better-sqlite3 file, in-memory test DB, or D1).
 */
export async function seedReferenceData(db: Db): Promise<void> {
  // Guard: refuse to run if data already exists.
  const existingExercises = await db.select().from(exercises).limit(1);
  if (existingExercises.length > 0) {
    throw new Error(
      'Refusing to seed: exercises table is not empty. ' +
        'Wipe the DB or run migrations on a fresh database first.',
    );
  }

  console.log('Seeding exercises...');
  const exerciseIdByName = await seedExercises(db);
  console.log(`  ✓ ${EXERCISES.length} exercises inserted`);

  console.log('Seeding routines...');
  const routineIds = await seedRoutines(db);
  console.log(`  ✓ ${ROUTINES.length} routines inserted`);

  console.log('Seeding routine_days (hombre)...');
  const hombreDayIds = await seedRoutineDays(
    db,
    routineIds.hombre,
    ROUTINE_DAYS_HOMBRE,
  );
  console.log(`  ✓ ${ROUTINE_DAYS_HOMBRE.length} days`);

  console.log('Seeding routine_days (mujer)...');
  const mujerDayIds = await seedRoutineDays(
    db,
    routineIds.mujer,
    ROUTINE_DAYS_MUJER,
  );
  console.log(`  ✓ ${ROUTINE_DAYS_MUJER.length} days`);

  console.log('Seeding routine_exercises (hombre)...');
  await seedRoutineExercises(
    db,
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
    db,
    mujerDayIds,
    ROUTINE_EXERCISES_MUJER,
    exerciseIdByName,
  );
  const mujerCount = [...ROUTINE_EXERCISES_MUJER.values()].reduce(
    (sum, slots) => sum + slots.length,
    0,
  );
  console.log(`  ✓ ${mujerCount} routine_exercises`);

  await seedExtraTemplates(db, exerciseIdByName);
  console.log(`  ✓ ${EXTRA_TEMPLATES.length} extra templates`);

  console.log('Done.');
}
