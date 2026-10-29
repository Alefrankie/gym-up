// End-to-end tests of the exercise library (ADR-017) and user-owned programs (ADR-018),
// over real HTTP with the real migrations and seed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as schema from '@db/schema';
import { seedReferenceData } from '../../db/seed';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { GetNextWorkoutUseCase } from '../../src/lib/contexts/routines/application/get-next-workout.use-case';
import { AdoptProgramUseCase } from '../../src/lib/contexts/routines/application/program.use-cases';
import { SqliteProgramRepository } from '../../src/lib/contexts/routines/infrastructure/sqlite/sqlite-program.repository';
import { SqliteWorkoutRepository } from '../../src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { createApp } from '../../src/nest/create-app';
import {
  libraryExerciseListResponseSchema,
  programDetailDtoSchema,
  programListResponseSchema,
  sessionResponseSchema,
  startWorkoutResponseSchema,
  todayWorkoutResponseSchema,
  type ProgramDetailDto,
} from '@gym-up/contracts';

const fakeHasher: PasswordHasher = {
  hash: async (p) => `fake$${p}`,
  verify: async (p, h) => h === `fake$${p}`,
};

let app: INestApplication;
let db: Db;
let base: string;

async function http(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

async function register(email: string, routineType: 'hombre' | 'mujer' = 'hombre') {
  const r = await http('POST', '/auth/register', {
    body: { email, password: 'longenough', displayName: 'Tester', routineType, weightUnit: 'kg' },
  });
  expect(r.status).toBe(201);
  return sessionResponseSchema.parse(r.json);
}

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  }
  db = drizzle(sqlite, { schema }) as unknown as Db;
  await seedReferenceData(db);
  const created = await createApp({ db, hasher: fakeHasher });
  app = created.app;
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

const customBody = (name: string) => ({
  name,
  primaryMuscle: 'chest',
  secondaryMuscles: ['triceps'],
  equipment: 'dumbbell',
  exerciseType: 'weight_reps',
  instructions: '1. Empuja.',
});

describe('exercise library', () => {
  it('requires authentication', async () => {
    expect((await http('GET', '/exercises')).status).toBe(401);
  });

  it('lists the seeded system exercises with the new taxonomy and filters them', async () => {
    const s = await register('lib1@example.com');
    const all = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises', { token: s.token })).json);
    expect(all.items).toHaveLength(35);
    const squat = all.items.find((e) => e.name === 'Squat')!;
    expect(squat).toMatchObject({ primaryMuscle: 'quadriceps', equipment: 'barbell', isCustom: false });
    expect(squat.secondaryMuscles).toEqual(['glutes', 'hamstrings']);
    expect(squat.instructions).toMatch(/^1\./);

    const glutes = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises?muscle=glutes', { token: s.token })).json);
    // primary or secondary
    expect(glutes.items.map((e) => e.name)).toEqual(expect.arrayContaining(['Hip Thrust', 'Squat']));
    const search = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises?q=curl&equipment=cable', { token: s.token })).json);
    expect(search.items).toEqual([]);
    const curls = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises?q=curl', { token: s.token })).json);
    expect(curls.items.map((e) => e.name).sort()).toEqual(['Barbell Bicep Curl', 'Bicep Curl', 'Hammer Curl', 'Leg Curl', 'Seated Leg Curl']);
  });

  it('creates custom exercises (idempotent by id), visible to everyone, editable by the owner only', async () => {
    const owner = await register('lib2@example.com');
    const other = await register('lib3@example.com');
    const id = crypto.randomUUID();
    const first = await http('POST', '/exercises', { token: owner.token, body: { id, ...customBody('Svend Press') } });
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ id, isCustom: true, primaryMuscle: 'chest' });
    const replay = await http('POST', '/exercises', { token: owner.token, body: { id, ...customBody('Svend Press') } });
    expect(replay.status).toBe(200);
    expect(replay.json.id).toBe(id);

    const seenByOther = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises?q=svend', { token: other.token })).json);
    expect(seenByOther.items).toHaveLength(1);

    expect((await http('PATCH', `/exercises/${id}`, { token: other.token, body: { name: 'Hacked' } })).status).toBe(403);
    expect((await http('DELETE', `/exercises/${id}`, { token: other.token })).status).toBe(403);
    const edited = await http('PATCH', `/exercises/${id}`, { token: owner.token, body: { equipment: 'other' } });
    expect(edited.status).toBe(200);
    expect(edited.json.equipment).toBe('other');

    const mine = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises?mine=true', { token: owner.token })).json);
    expect(mine.items.map((e) => e.id)).toEqual([id]);
  });

  it('rejects duplicate names (system or custom, case-insensitive) and invalid input', async () => {
    const s = await register('lib4@example.com');
    expect((await http('POST', '/exercises', { token: s.token, body: customBody('bench press') })).status).toBe(409);
    expect((await http('POST', '/exercises', { token: s.token, body: { ...customBody('X1'), primaryMuscle: 'wings' } })).status).toBe(400);
    expect((await http('POST', '/exercises', { token: s.token, body: customBody('A') })).status).toBe(400);
  });

  it('archives instead of deleting, and hides archived exercises', async () => {
    const s = await register('lib5@example.com');
    const id = crypto.randomUUID();
    await http('POST', '/exercises', { token: s.token, body: { id, ...customBody('Archivable Press') } });
    expect((await http('DELETE', `/exercises/${id}`, { token: s.token })).status).toBe(204);
    const list = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises?q=archivable', { token: s.token })).json);
    expect(list.items).toEqual([]);
    // still readable by id (workouts and routines keep referencing it)
    const one = await http('GET', `/exercises/${id}`, { token: s.token });
    expect(one.json.isArchived).toBe(true);
    expect((await http('GET', '/exercises/nope', { token: s.token })).status).toBe(404);
  });
});

describe('programs', () => {
  it('lists the six seeded templates', async () => {
    const s = await register('prog1@example.com');
    const r = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    expect(r.templates.map((t) => t.name).sort()).toEqual([
      'Female Glute Focus 5-Day',
      'Full Body 3-Day',
      'Lower Body (Gravl)',
      'Male 5-Day Split',
      'Push / Pull / Legs',
      'Upper / Lower 4-Day',
    ]);
    expect(r.mine).toEqual([]);
    expect(r.activeProgramId).toBeNull();
  });

  it('adopts a template as a deep copy and activates it', async () => {
    const s = await register('prog2@example.com');
    const list = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    const ppl = list.templates.find((t) => t.name === 'Push / Pull / Legs')!;
    const adopted = programDetailDtoSchema.parse((await http('POST', `/programs/${ppl.id}/adopt`, { token: s.token })).json);
    expect(adopted.id).not.toBe(ppl.id);
    expect(adopted).toMatchObject({ isTemplate: false, sourceTemplateId: ppl.id, routineCount: 3 });
    expect(adopted.routines.map((r) => r.name)).toEqual(['Push', 'Pull', 'Legs']);

    const after = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    expect(after.activeProgramId).toBe(adopted.id);
    expect(after.mine).toHaveLength(1);

    // the template is untouched and cannot be edited
    const template = programDetailDtoSchema.parse((await http('GET', `/programs/${ppl.id}`, { token: s.token })).json);
    expect(template.routines).toHaveLength(3);
    expect(template.routines[0]!.id).not.toBe(adopted.routines[0]!.id);
    const put = await http('PUT', `/programs/${ppl.id}`, { token: s.token, body: { name: 'x', routines: [] } });
    expect(put.status).toBe(403);
  });

  it('builds a program, saves routines idempotently, reorders and removes', async () => {
    const s = await register('prog3@example.com');
    const exercises = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises', { token: s.token })).json).items;
    const idOf = (n: string) => exercises.find((e) => e.name === n)!.id;
    const id = crypto.randomUUID();
    const created = programDetailDtoSchema.parse((await http('POST', '/programs', { token: s.token, body: { id, name: 'Mi plan' } })).json);
    expect(created.routineCount).toBe(0);
    // first program becomes active
    expect(programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json).activeProgramId).toBe(id);

    const dayA = crypto.randomUUID();
    const dayB = crypto.randomUUID();
    const body = {
      name: 'Mi plan v2',
      description: 'Dos días',
      routines: [
        { id: dayA, name: 'A', focus: 'Pecho', exercises: [{ exerciseId: idOf('Bench Press'), targetSets: 4, targetReps: 8, warmupSets: 1, restSeconds: 120 }] },
        { id: dayB, name: 'B', focus: 'Pierna', exercises: [{ exerciseId: idOf('Squat'), targetSets: 5, targetReps: 5, warmupSets: 0 }] },
      ],
    };
    const saved = programDetailDtoSchema.parse((await http('PUT', `/programs/${id}`, { token: s.token, body })).json);
    expect(saved).toMatchObject({ name: 'Mi plan v2', routineCount: 2, daysPerWeek: 2 });
    expect(saved.routines[0]!.exercises[0]).toMatchObject({ exerciseName: 'Bench Press', targetReps: 8, warmupSets: 1, restSeconds: 120 });

    // replaying the same save changes nothing (ids are kept)
    const again = programDetailDtoSchema.parse((await http('PUT', `/programs/${id}`, { token: s.token, body })).json);
    expect(again.routines.map((r) => r.id)).toEqual([dayA, dayB]);

    // reorder and drop an exercise
    const reordered: ProgramDetailDto['routines'] = again.routines;
    const swap = await http('PUT', `/programs/${id}`, {
      token: s.token,
      body: { ...body, routines: [{ ...body.routines[1]! }, { ...body.routines[0]!, exercises: [] }] },
    });
    expect(swap.status).toBe(200);
    const swapped = programDetailDtoSchema.parse(swap.json);
    expect(swapped.routines.map((r) => [r.id, r.dayNumber])).toEqual([[dayB, 1], [dayA, 2]]);
    expect(swapped.routines[1]!.exercises).toEqual([]);
    expect(reordered).toHaveLength(2);

    // validation
    const badReps = await http('PUT', `/programs/${id}`, {
      token: s.token,
      body: { name: 'x', routines: [{ name: 'A', exercises: [{ exerciseId: idOf('Squat'), targetSets: 3, targetReps: 0 }] }] },
    });
    expect(badReps.status).toBe(400);
    const unknown = await http('PUT', `/programs/${id}`, {
      token: s.token,
      body: { name: 'x', routines: [{ name: 'A', exercises: [{ exerciseId: 'ghost', targetSets: 3, targetReps: 10 }] }] },
    });
    expect(unknown.status).toBe(400);
  });

  it('saves a per-set plan (reps and kind of each set) and serves it to the workout', async () => {
    const s = await register('plan@example.com');
    const exercises = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises', { token: s.token })).json).items;
    const squat = exercises.find((e) => e.name === 'Squat')!.id;
    const id = crypto.randomUUID();
    await http('POST', '/programs', { token: s.token, body: { id, name: 'Plan' } });
    const sets = [
      { reps: 12, type: 'warmup' },
      { reps: 8, type: 'normal' },
      { reps: 6, type: 'failure' },
      { reps: 10, type: 'drop' },
    ];
    const body = { name: 'Plan', routines: [{ name: 'A', exercises: [{ exerciseId: squat, targetSets: 4, targetReps: 8, warmupSets: 1, sets }] }] };
    const saved = programDetailDtoSchema.parse((await http('PUT', `/programs/${id}`, { token: s.token, body })).json);
    expect(saved.routines[0]!.exercises[0]!.sets).toEqual(sets);

    const today = (await http('GET', '/workouts/today', { token: s.token })).json as { exercises: { sets: unknown }[] };
    expect(today.exercises[0]!.sets).toEqual(sets);

    const bad = await http('PUT', `/programs/${id}`, {
      token: s.token,
      body: { ...body, routines: [{ name: 'A', exercises: [{ exerciseId: squat, targetSets: 1, targetReps: 8, sets: [{ reps: 8, type: 'mega' }] }] }] },
    });
    expect(bad.status).toBe(400);
  });

  it('remembers the last session of an exercise and its all-time record, ignoring warm-ups', async () => {
    const s = await register('record@example.com');
    const programs = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    const mine = programDetailDtoSchema.parse((await http('POST', `/programs/${programs.templates[0]!.id}/adopt`, { token: s.token })).json);
    const day = mine.routines[0]!;
    const ex = day.exercises[0]!.exerciseId;
    const userId = s.user.id;
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
    const workout = async (daysAgo: number, sets: { reps: number; weight: number; setType?: 'normal' | 'warmup' }[]) => {
      const id = crypto.randomUUID();
      await db.insert(schema.workouts).values({ id, userId, routineDayId: day.id, workoutDate: at(daysAgo), status: 'completed' });
      for (const [i, set] of sets.entries()) {
        await db.insert(schema.workoutEntries).values({ workoutId: id, exerciseId: ex, setNumber: i + 1, completed: true, setType: 'normal', ...set });
      }
    };
    await workout(10, [{ reps: 6, weight: 110 }, { reps: 4, weight: 110 }]);
    await workout(2, [{ reps: 15, weight: 200, setType: 'warmup' }, { reps: 10, weight: 100 }, { reps: 8, weight: 100 }]);

    const last = (await new SqliteProgramRepository(db).lastPerformance(userId, [ex], new Date())).get(ex)!;
    expect(last).toMatchObject({ weight: 100, reps: 10, sets: [{ reps: 10, weight: 100 }, { reps: 8, weight: 100 }] });
    expect(last.record).toMatchObject({ weight: 110, reps: 6 });
  });

  it('keeps programs private to their owner and archives them', async () => {
    const a = await register('prog4@example.com');
    const b = await register('prog5@example.com');
    const id = crypto.randomUUID();
    await http('POST', '/programs', { token: a.token, body: { id, name: 'Privado' } });
    expect((await http('GET', `/programs/${id}`, { token: b.token })).status).toBe(404);
    expect((await http('PUT', `/programs/${id}`, { token: b.token, body: { name: 'x', routines: [] } })).status).toBe(404);
    expect((await http('DELETE', `/programs/${id}`, { token: b.token })).status).toBe(404);

    expect((await http('DELETE', `/programs/${id}`, { token: a.token })).status).toBe(204);
    const list = programListResponseSchema.parse((await http('GET', '/programs', { token: a.token })).json);
    expect(list.mine).toEqual([]);
    expect(list.activeProgramId).toBeNull();
  });

  it('refuses to activate a template or an empty program', async () => {
    const s = await register('prog6@example.com');
    const list = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    expect((await http('POST', `/programs/${list.templates[0]!.id}/activate`, { token: s.token })).status).toBe(400);
    const id = crypto.randomUUID();
    await http('POST', '/programs', { token: s.token, body: { id, name: 'Vacío' } });
    expect((await http('POST', `/programs/${id}/activate`, { token: s.token })).status).toBe(400);
  });
});

describe('today follows the program rotation', () => {
  it('adopts the profile template lazily and advances after each completed workout', async () => {
    const s = await register('rot1@example.com', 'mujer');
    const today1 = todayWorkoutResponseSchema.parse((await http('GET', '/workouts/today', { token: s.token })).json);
    if (today1.kind !== 'workout_day') throw new Error('expected workout_day');
    expect(today1.programName).toBe('Female Glute Focus 5-Day');
    expect(today1.dayNumber).toBe(1);

    const programs = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    expect(programs.mine).toHaveLength(1);
    expect(programs.activeProgramId).toBe(programs.mine[0]!.id);

    const start = startWorkoutResponseSchema.parse(
      (await http('POST', '/workouts', { token: s.token, body: { id: crypto.randomUUID(), routineDayId: today1.routineDay.id } })).json,
    );
    const pinned = todayWorkoutResponseSchema.parse((await http('GET', '/workouts/today', { token: s.token })).json);
    if (pinned.kind !== 'workout_day') throw new Error('expected workout_day');
    expect(pinned).toMatchObject({ dayNumber: 1, workoutStatus: 'in_progress', existingWorkoutId: start.workout.id });
  });

  it('advances to the next routine after each completed workout and wraps around', async () => {
    const s = await register('rot2@example.com');
    const user = (await http('GET', '/auth/me', { token: s.token })).json;
    const programs = new SqliteProgramRepository(db);
    const next = new GetNextWorkoutUseCase(programs, new SqliteWorkoutRepository(db), new AdoptProgramUseCase(programs));
    const library = libraryExerciseListResponseSchema.parse((await http('GET', '/exercises', { token: s.token })).json).items;

    const dayOf = async (daysAhead: number) => {
      const r = await next.execute({ userId: user.id, routineType: 'hombre', now: new Date(Date.now() + daysAhead * 86_400_000) });
      if (r.kind !== 'workout_day') throw new Error('expected workout_day');
      return r;
    };

    const seen: number[] = [];
    for (let d = 0; d < 6; d++) {
      const day = await dayOf(d);
      seen.push(day.dayNumber);
      // the workout is logged "today" in the API clock, so a later day only changes the rotation lookup
      if (d === 0) {
        const id = crypto.randomUUID();
        await http('POST', '/workouts', { token: s.token, body: { id, routineDayId: day.routineDay.id } });
        await http('PUT', `/workouts/${id}/sets`, {
          token: s.token,
          body: { id: crypto.randomUUID(), exerciseId: library[0]!.id, setNumber: 1, reps: 8, weight: 50, weightUnit: 'kg', completed: true, notes: null },
        });
        expect((await http('POST', `/workouts/${id}/complete`, { token: s.token })).status).toBe(200);
      } else {
        // same day pinned or advanced depending on completed history: day 1 done, so from tomorrow on it is day 2
        expect(day.dayNumber).toBe(2);
      }
    }
    expect(seen[0]).toBe(1);
  });

  it('wraps to the first routine after the last one of the program', async () => {
    const s = await register('rot3@example.com');
    const user = (await http('GET', '/auth/me', { token: s.token })).json;
    const programs = new SqliteProgramRepository(db);
    const next = new GetNextWorkoutUseCase(programs, new SqliteWorkoutRepository(db), new AdoptProgramUseCase(programs));
    const first = await next.execute({ userId: user.id, routineType: 'hombre' });
    if (first.kind !== 'workout_day') throw new Error('expected workout_day');
    const programId = (await programs.getActiveProgramId(user.id))!;
    const tree = (await programs.findTree(programId))!;
    const last = tree.routines[tree.routines.length - 1]!;
    // a completed workout on the last routine, logged two days ago
    await db.insert(schema.workouts).values({
      userId: user.id,
      routineDayId: last.day.id,
      workoutDate: new Date(Date.now() - 2 * 86_400_000),
      status: 'completed',
    });
    const after = await next.execute({ userId: user.id, routineType: 'hombre' });
    if (after.kind !== 'workout_day') throw new Error('expected workout_day');
    expect(last.day.dayNumber).toBe(5);
    expect(after.dayNumber).toBe(1);
  });

  it('starts any routine of the program on any day, several in one day, and previews it with last loads', async () => {
    const s = await register('any-day@example.com');
    const programs = programListResponseSchema.parse((await http('GET', '/programs', { token: s.token })).json);
    const ppl = programs.templates.find((t) => t.name === 'Push / Pull / Legs')!;
    const mine = programDetailDtoSchema.parse((await http('POST', `/programs/${ppl.id}/adopt`, { token: s.token })).json);
    const [push, pull] = mine.routines;

    // Preview a routine that is not the next one in the rotation.
    const preview = todayWorkoutResponseSchema.parse((await http('GET', `/workouts/routine/${pull!.id}`, { token: s.token })).json);
    if (preview.kind !== 'workout_day') throw new Error('expected workout_day');
    expect(preview).toMatchObject({ programName: 'Push / Pull / Legs', dayNumber: 2, workoutStatus: 'not_started', existingWorkoutId: null });
    expect(preview.exercises.length).toBe(pull!.exercises.length);

    // Start both routines the same day: two workouts, and replaying a start returns the same one.
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const startA = startWorkoutResponseSchema.parse((await http('POST', '/workouts', { token: s.token, body: { id: a, routineDayId: push!.id } })).json);
    const startB = startWorkoutResponseSchema.parse((await http('POST', '/workouts', { token: s.token, body: { id: b, routineDayId: pull!.id } })).json);
    expect(startA).toMatchObject({ kind: 'started', workout: { id: a } });
    expect(startB).toMatchObject({ kind: 'started', workout: { id: b } });
    const replay = startWorkoutResponseSchema.parse((await http('POST', '/workouts', { token: s.token, body: { id: crypto.randomUUID(), routineDayId: pull!.id } })).json);
    expect(replay).toMatchObject({ kind: 'resumed', workout: { id: b } });

    // The preview now knows the routine is in progress, and a foreign routine does not exist for this user.
    const again = todayWorkoutResponseSchema.parse((await http('GET', `/workouts/routine/${pull!.id}`, { token: s.token })).json);
    expect(again).toMatchObject({ kind: 'workout_day', workoutStatus: 'in_progress', existingWorkoutId: b });
    const other = await register('any-day-2@example.com');
    expect((await http('GET', `/workouts/routine/${pull!.id}`, { token: other.token })).json).toEqual({ kind: 'no_routine' });
  });
});
