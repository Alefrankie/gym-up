import 'fake-indexeddb/auto';
import type { RoutineExerciseDto } from '@gym-up/contracts';
import { expect, it } from 'vitest';
import { loadSnapshot } from './workout-session';
import { WorkoutView } from './workout-view.svelte';

const exercise: RoutineExerciseDto = {
  id: 'routine-press',
  exerciseId: 'press',
  exerciseName: 'Press',
  muscleGroup: 'chest',
  targetSets: 3,
  targetReps: 10,
  exerciseOrder: 0,
};

it.each([false, true])('preserves the next set when completed is %s, otherwise carries the edit', async (completed) => {
  const id = `weight-edit-${completed}`;
  const view = new WorkoutView(id);
  view.snap = {
    workoutId: id,
    routineDayId: 'day',
    dayName: 'Training',
    exercises: [exercise],
    rows: {
      'press:1': { id: '1', weight: 12, reps: 10, completed: false },
      'press:2': { id: '2', weight: 10, reps: 8, completed },
      'press:3': { id: '3', weight: 10, reps: 10, completed: false },
    },
    status: 'in_progress',
    unit: 'kg',
    startedAt: 0,
  };

  view.weightChanged(exercise, 1);
  await view.edited(exercise.exerciseId, 1);

  const expected = { weight: completed ? 10 : 12, reps: 8, completed };
  expect(view.row(exercise.exerciseId, 2)).toMatchObject(expected);
  const saved = await loadSnapshot(id);
  expect(saved?.rows['press:2']).toMatchObject(expected);
  expect(saved?.rows['press:3']?.weight).toBe(10);
});
