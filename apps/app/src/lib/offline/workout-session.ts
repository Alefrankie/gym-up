// Local state of a live workout (the `sessions` store of ADR-025). It is the source of truth while the
// workout is open: every keystroke that matters is written here first, so a reload, a killed app or a
// dead signal never loses a set. The outbox (outbox.ts) carries the same changes to the server.

import type { RoutineExerciseDto, WeightUnit } from '@gym-up/contracts';
import type { SetType } from '@gym-up/contracts';
import { kv } from './idb';

export interface SetRow {
  /** Client-generated id; the same id is sent on every retry (idempotent upsert). */
  id: string;
  reps: number;
  /** In `WorkoutSnapshot.unit`, as typed by the user. */
  weight: number;
  completed: boolean;
  /** Missing on snapshots saved before set types existed: read as 'normal'. */
  type?: SetType;
  /** When the set was ticked (epoch ms): tells when the session really ended if finish was forgotten. */
  doneAt?: number;
}

export interface WorkoutSnapshot {
  workoutId: string;
  routineDayId: string;
  dayName: string;
  exercises: RoutineExerciseDto[];
  /** Keyed by `exerciseId:setNumber`. */
  rows: Record<string, SetRow>;
  status: 'in_progress' | 'completed';
  unit: WeightUnit;
  startedAt: number;
  /** Set when logging a workout done on an earlier day (YYYY-MM-DD): no live timer then. */
  day?: string;
}

const sessionKey = (id: string) => `session:${id}`;
const ACTIVE = 'active-workout';

export const rowKey = (exerciseId: string, setNumber: number) => `${exerciseId}:${setNumber}`;

export async function loadSnapshot(workoutId: string): Promise<WorkoutSnapshot | undefined> {
  return kv.get<WorkoutSnapshot>(sessionKey(workoutId));
}

export async function saveSnapshot(snapshot: WorkoutSnapshot): Promise<void> {
  // $state proxies are not structured-cloneable, so persist a plain copy.
  await kv.set(sessionKey(snapshot.workoutId), JSON.parse(JSON.stringify(snapshot)));
}

export async function deleteSnapshot(workoutId: string): Promise<void> {
  await kv.delete(sessionKey(workoutId));
}

/** The workout currently open on this device, so the dashboard can offer "continue" even with no signal. */
export async function getActiveWorkoutId(): Promise<string | null> {
  return (await kv.get<string>(ACTIVE)) ?? null;
}

export async function setActiveWorkoutId(workoutId: string | null): Promise<void> {
  if (workoutId) await kv.set(ACTIVE, workoutId);
  else await kv.delete(ACTIVE);
}

/** A server remap (see Remap in outbox.ts): move the snapshot and the pointer to the new id. */
export async function remapSnapshot(from: string, to: string): Promise<void> {
  const snap = await loadSnapshot(from);
  if (snap) {
    await saveSnapshot({ ...snap, workoutId: to });
    await deleteSnapshot(from);
  }
  if ((await getActiveWorkoutId()) === from) await setActiveWorkoutId(to);
}

export async function clearAllSessions(): Promise<void> {
  for (const k of await kv.keys('session:')) await kv.delete(k);
  await kv.delete(ACTIVE);
}
