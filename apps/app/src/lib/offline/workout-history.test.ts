import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { cachedGet } from './cache';
import { rowKey } from './workout-session';
import { WorkoutView } from './workout-view.svelte';

vi.mock('./cache', async (importOriginal) => ({
  ...await importOriginal<typeof import('./cache')>(),
  cachedGet: vi.fn(),
}));

it('fills untouched defaults from recovered history and keeps user-entered values', async () => {
  const exerciseId = 'pec-deck';
  const view = new WorkoutView('workout');
  view.snap = {
    workoutId: 'workout',
    routineDayId: 'routine',
    dayName: 'Monday',
    exercises: [{
      id: 'slot', exerciseId, exerciseName: 'Pec Deck', muscleGroup: 'chest',
      targetSets: 2, targetReps: 10, exerciseOrder: 1,
    }],
    rows: {
      [rowKey(exerciseId, 1)]: { id: 'first', weight: 0, reps: 10, completed: false, awaitingHistory: true },
      [rowKey(exerciseId, 2)]: { id: 'second', weight: 31, reps: 9, completed: false },
    },
    status: 'in_progress',
    startedAt: Date.parse('2026-11-28T12:00:00Z'),
    unit: 'kg',
  };
  const last = { weight: 50, reps: 8, date: '2026-11-23', sets: [{ weight: 45, reps: 10 }, { weight: 50, reps: 8 }] };
  vi.mocked(cachedGet).mockResolvedValue({ data: { last }, stale: false, fetchedAt: 0 });

  await view.loadExerciseHistory(exerciseId);

  expect(view.snap.exercises[0]?.last).toEqual(last);
  expect(view.row(exerciseId, 1)).toMatchObject({ id: 'first', weight: 45, reps: 10 });
  expect(view.row(exerciseId, 2)).toMatchObject({ id: 'second', weight: 31, reps: 9 });

  // A completed set stays in the workout; a removed draft must not mask the suggestion on re-add.
  view.row(exerciseId, 1)!.completed = true;
  await view.removeExercise(exerciseId);
  await view.addExercise({ id: exerciseId, name: 'Pec Deck', primaryMuscle: 'chest', secondaryMuscles: [] });
  await view.loadExerciseHistory(exerciseId);

  await vi.waitFor(() => expect(view.snap?.exercises[0]?.last).toEqual(last));
  expect(view.row(exerciseId, 1)).toMatchObject({ id: 'first', weight: 45, completed: true });
  expect(view.row(exerciseId, 2)).toMatchObject({ weight: 50, reps: 8, completed: false });
});
