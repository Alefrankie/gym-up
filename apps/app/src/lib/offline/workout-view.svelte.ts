import { goto } from '$app/navigation';
import { todayWorkoutResponseSchema, workoutDetailSchema, type RoutineExerciseDto } from '@gym-up/contracts';
import { api, ApiRequestError } from '#lib/api/client';
import { cachedGet } from './cache';
import { restTimer } from './rest.svelte';
import { cancelWorkoutById } from './start-workout';
import { sync } from './sync.svelte';
import { loadSnapshot, rowKey, saveSnapshot, setActiveWorkoutId, type WorkoutSnapshot } from './workout-session';
import { session } from '#lib/session';

const KG_TO_LBS = 2.20462;
export const toDisplay = (kg: number, u: 'kg' | 'lbs') => (u === 'lbs' ? Math.round(kg * KG_TO_LBS * 10) / 10 : kg);

/**
 * State and actions of one workout, shared by the routine overview and the single-exercise screen. Both read the
 * local snapshot first (works with no signal) and every change is written locally, then queued for the server.
 */
export class WorkoutView {
  snap = $state<WorkoutSnapshot | null>(null);
  error = $state<string | null>(null);
  finishing = $state(false);
  cancelling = $state(false);
  now = $state(Date.now());

  #id: string;
  #tick: ReturnType<typeof setInterval> | undefined;
  #unsubscribe: (() => void) | undefined;

  constructor(id: string) {
    this.#id = id;
  }

  get unit(): 'kg' | 'lbs' {
    return this.snap?.unit ?? 'kg';
  }
  get isCompleted(): boolean {
    return this.snap?.status === 'completed';
  }

  /** Time since the workout started; anything past 6 h is a forgotten session, not a clock. */
  get elapsed(): string | null {
    if (!this.snap || this.isCompleted) return null;
    const secs = Math.floor((this.now - this.snap.startedAt) / 1000);
    if (secs < 0 || secs > 6 * 3600) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Sets shown for an exercise: the target, or more if the workout already has more. */
  setNumbers(ex: RoutineExerciseDto): number[] {
    const used = Object.keys(this.snap?.rows ?? {})
      .filter((k) => k.startsWith(`${ex.exerciseId}:`))
      .map((k) => Number(k.split(':')[1]));
    return Array.from({ length: Math.max(ex.targetSets, ...used, 0) }, (_, i) => i + 1);
  }

  row(exerciseId: string, n: number) {
    return this.snap?.rows[rowKey(exerciseId, n)];
  }

  /** Completed / total sets of one exercise. */
  progress(ex: RoutineExerciseDto): { done: number; total: number } {
    const nums = this.setNumbers(ex);
    return { done: nums.filter((n) => this.row(ex.exerciseId, n)?.completed).length, total: nums.length };
  }

  /** The first set not done yet: the one to highlight. */
  activeSet(ex: RoutineExerciseDto): number | null {
    return this.setNumbers(ex).find((n) => !this.row(ex.exerciseId, n)?.completed) ?? null;
  }

  get anyCompleted(): boolean {
    return Object.values(this.snap?.rows ?? {}).some((r) => r.completed);
  }

  /** Every visible set gets a row (with its own stable id) before the first render of the list. */
  #ensureRows(s: WorkoutSnapshot) {
    for (const ex of s.exercises) {
      for (let i = 1; i <= Math.max(ex.targetSets, 0); i++) this.#ensureRow(s, ex, i);
    }
  }

  #ensureRow(s: WorkoutSnapshot, ex: RoutineExerciseDto, n: number) {
    const k = rowKey(ex.exerciseId, n);
    s.rows[k] ??= {
      id: crypto.randomUUID(),
      reps: ex.targetReps,
      // Start from what you lifted last time: the number to beat is already in the box.
      weight: ex.last ? toDisplay(ex.last.weight, s.unit) : 0,
      completed: false,
    };
  }

  /** `onRemap` receives the new id when the server answered the start command with another workout of the day. */
  async init(onRemap: (newId: string) => void) {
    this.#tick = setInterval(() => (this.now = Date.now()), 1000);
    if (!(await session.require())) return;
    this.#unsubscribe = sync.onRemap((r) => {
      if (r.from === this.#id) onRemap(r.to);
    });
    const local = await loadSnapshot(this.#id);
    if (local) {
      this.#ensureRows(local);
      this.snap = local;
      void this.#mergeServer(); // best effort; the local copy is already usable
      return;
    }
    await this.#buildFromServer();
  }

  destroy() {
    clearInterval(this.#tick);
    this.#unsubscribe?.();
  }

  /** Opens a workout this device has no local copy of (history, another device). Needs the server or the cache. */
  async #buildFromServer() {
    const id = this.#id;
    try {
      const detail = await api(`/workouts/${id}`, { schema: workoutDetailSchema });
      const today = await cachedGet('/workouts/today', todayWorkoutResponseSchema);
      let exercises: RoutineExerciseDto[] = [];
      let dayName = 'Entrenamiento';
      let u = session.user?.weightUnit ?? 'kg';
      if (today.data.kind === 'workout_day' && today.data.existingWorkoutId === id) {
        exercises = today.data.exercises;
        dayName = today.data.routineDay.dayName;
        u = today.data.weightUnit;
      } else {
        const seen = new Map<string, RoutineExerciseDto>();
        for (const e of detail.entries) {
          if (!seen.has(e.exerciseId)) {
            seen.set(e.exerciseId, {
              id: e.exerciseId,
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              muscleGroup: e.muscleGroup,
              targetSets: 0,
              targetReps: 10,
              exerciseOrder: seen.size + 1,
            });
          }
        }
        exercises = [...seen.values()];
      }
      const built: WorkoutSnapshot = {
        workoutId: id,
        routineDayId: detail.workout.routineDayId,
        dayName,
        exercises,
        rows: {},
        status: detail.workout.status,
        unit: u,
        startedAt: Date.parse(detail.workout.startedAt),
      };
      for (const e of detail.entries) {
        built.rows[rowKey(e.exerciseId, e.setNumber)] = {
          id: e.id,
          reps: e.reps,
          weight: toDisplay(e.weight, u),
          completed: e.completed,
        };
      }
      this.#ensureRows(built);
      await saveSnapshot(built);
      this.snap = built;
    } catch (e) {
      this.error =
        e instanceof ApiRequestError ? e.message : 'Sin conexión. Este entrenamiento no está guardado en el teléfono.';
    }
  }

  /** Brings in what the server knows, without touching sets that still have a pending local change. */
  async #mergeServer() {
    const snap = this.snap;
    if (!snap) return;
    try {
      const detail = await api(`/workouts/${this.#id}`, { schema: workoutDetailSchema, timeoutMs: 6000 });
      const pending = await sync.outbox.pendingSetIds(this.#id);
      for (const e of detail.entries) {
        const k = rowKey(e.exerciseId, e.setNumber);
        const mine = snap.rows[k];
        if (mine && pending.has(mine.id)) continue;
        snap.rows[k] = { id: e.id, reps: e.reps, weight: toDisplay(e.weight, snap.unit), completed: e.completed };
      }
      if (detail.workout.status === 'completed') snap.status = 'completed';
      await saveSnapshot(snap);
    } catch {
      /* offline or the start command has not reached the server yet: keep the local copy */
    }
  }

  /** Writes the local copy, then queues the change for the server. Works with no signal. */
  async commit(exerciseId: string, setNumber: number, completed: boolean) {
    const snap = this.snap;
    const r = snap?.rows[rowKey(exerciseId, setNumber)];
    if (!snap || !r) return;
    r.completed = completed;
    await saveSnapshot(snap);
    await sync.enqueue({
      type: 'upsert-set',
      workoutId: this.#id,
      set: {
        id: r.id,
        exerciseId,
        setNumber,
        reps: r.reps,
        weight: r.weight,
        weightUnit: snap.unit,
        completed,
        notes: null,
      },
    });
    if (completed) restTimer.start();
  }

  /** Editing a set that is already completed re-sends it; editing an open one only updates the local copy. */
  async edited(exerciseId: string, setNumber: number) {
    const snap = this.snap;
    const r = snap?.rows[rowKey(exerciseId, setNumber)];
    if (!snap || !r) return;
    if (r.completed) await this.commit(exerciseId, setNumber, true);
    else await saveSnapshot(snap);
  }

  /** Adds one more set to an exercise, copying the previous set's reps and weight. */
  async addSet(ex: RoutineExerciseDto) {
    const snap = this.snap;
    if (!snap) return;
    const nums = this.setNumbers(ex);
    const n = (nums[nums.length - 1] ?? 0) + 1;
    const prev = snap.rows[rowKey(ex.exerciseId, n - 1)];
    snap.rows[rowKey(ex.exerciseId, n)] = {
      id: crypto.randomUUID(),
      reps: prev?.reps ?? ex.targetReps,
      weight: prev?.weight ?? 0,
      completed: false,
    };
    await saveSnapshot(snap);
  }

  /** Cancels the workout in progress: nothing of it is kept, here or on the server. Works with no signal. */
  async cancel(): Promise<void> {
    if (!this.snap || this.isCompleted) return;
    this.cancelling = true;
    await cancelWorkoutById(this.#id);
    await goto('/dashboard', { replaceState: true });
  }

  async finish(): Promise<boolean> {
    const snap = this.snap;
    if (!snap) return false;
    if (!this.anyCompleted) {
      this.error = 'Registra al menos una serie antes de finalizar';
      return false;
    }
    this.finishing = true;
    this.error = null;
    snap.status = 'completed';
    await saveSnapshot(snap);
    await sync.enqueue({ type: 'finish-workout', workoutId: this.#id });
    await setActiveWorkoutId(null);
    restTimer.skip();
    await goto('/history', { replaceState: true });
    return true;
  }
}
