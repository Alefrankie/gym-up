import { todayWorkoutResponseSchema, type TodayWorkoutResponse } from '@gym-up/contracts';
import { api } from '../api/client';
import { invalidateCache, updateCached } from './cache';
import { restTimer } from './rest.svelte';
import { sync } from './sync.svelte';
import { deleteSnapshot, getActiveWorkoutId, loadSnapshot, saveSnapshot, setActiveWorkoutId } from './workout-session';

type WorkoutDay = Extract<TodayWorkoutResponse, { kind: 'workout_day' }>;

/**
 * Starts locally first: the workout exists on this device immediately (id generated here, exercises from the
 * routine as the server last described it) and the `start-workout` command reaches the server whenever there is signal.
 * Returns the id of the workout to open.
 */
export async function beginWorkout(t: WorkoutDay, day?: string): Promise<string> {
  const active = await getActiveWorkoutId();
  // The routine's existing workout is today's; logging an earlier day is always a new one.
  const existing = day ? null : t.existingWorkoutId;
  const id = existing ?? active ?? crypto.randomUUID();
  if (!existing && !active) {
    await saveSnapshot({
      workoutId: id,
      routineDayId: t.routineDay.id,
      dayName: t.routineDay.dayName,
      exercises: t.exercises,
      rows: {},
      status: 'in_progress',
      unit: t.weightUnit,
      startedAt: Date.now(),
      ...(day ? { day } : {}),
    });
    await sync.enqueue({ type: 'start-workout', id, routineDayId: t.routineDay.id, ...(day ? { date: day } : {}) });
  }
  await setActiveWorkoutId(id);
  return id;
}

/** Throws away a workout in progress, here and (once there is signal) on the server. */
export async function cancelWorkoutById(id: string): Promise<void> {
  await sync.cancelWorkout(id);
  await deleteSnapshot(id);
  if ((await getActiveWorkoutId()) === id) await setActiveWorkoutId(null);
  restTimer.skip();
  // The cached copy of today's routine may still say "in progress": fix it so Inicio offers to start again.
  await updateCached<TodayWorkoutResponse>('/workouts/today', (d) =>
    d.kind === 'workout_day' && d.existingWorkoutId === id ? { ...d, workoutStatus: 'not_started', existingWorkoutId: null } : d,
  );
}

export type StartOutcome = { kind: 'started'; workoutId: string; firstExerciseId: string | null } | { kind: 'declined' } | { kind: 'missing' };

/**
 * Starts any routine of a program, on any day. If another workout is in progress the caller decides whether to
 * cancel it (`confirmReplace`); if this very routine is already in progress it is simply continued.
 */
/** `day` (YYYY-MM-DD) logs the routine as done on an earlier day instead of today. */
export async function startRoutine(
  routineDayId: string,
  confirmReplace: (inProgressName: string) => boolean,
  day?: string,
): Promise<StartOutcome> {
  const active = await getActiveWorkoutId();
  if (active) {
    const snap = await loadSnapshot(active);
    if (snap && snap.status === 'in_progress') {
      if (snap.routineDayId === routineDayId && snap.day === day) {
        return { kind: 'started', workoutId: active, firstExerciseId: snap.exercises[0]?.exerciseId ?? null };
      }
      if (!confirmReplace(snap.dayName)) return { kind: 'declined' };
      await cancelWorkoutById(active);
    }
  }
  const routine = await api(`/workouts/routine/${routineDayId}`, { schema: todayWorkoutResponseSchema });
  if (routine.kind !== 'workout_day') return { kind: 'missing' };
  const workoutId = await beginWorkout(routine, day);
  await invalidateCache(['/workouts/today']);
  return { kind: 'started', workoutId, firstExerciseId: routine.exercises[0]?.exerciseId ?? null };
}
