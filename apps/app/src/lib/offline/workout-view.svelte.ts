import { goto } from '$app/navigation';
import { todayWorkoutResponseSchema, workoutDetailSchema, type RoutineExerciseDto, type SetType } from '@gym-up/contracts';
import { api, ApiRequestError } from '#lib/api/client';
import { cachedGet } from './cache';
import { REST_SECONDS, restTimer } from './rest.svelte';
import { coachSay } from '#lib/coach/coach.svelte';
import { cancelWorkoutById } from './start-workout';
import { sync } from './sync.svelte';
import { loadSnapshot, rowKey, saveSnapshot, setActiveWorkoutId, type WorkoutSnapshot } from './workout-session';
import { session } from '#lib/session';
import { t } from '#lib/i18n';

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
    if (!this.snap || this.isCompleted || this.snap.day || this.snap.editing) return null;
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

  /** Completed sets of one exercise, in order, for summaries (history, finished workout). */
  doneSets(ex: RoutineExerciseDto): { n: number; reps: number; weight: number; type: SetType }[] {
    return this.setNumbers(ex)
      .map((n) => ({ n, r: this.row(ex.exerciseId, n) }))
      .filter((x) => x.r?.completed)
      .map(({ n, r }) => ({ n, reps: r!.reps, weight: r!.weight, type: r!.type ?? 'normal' }));
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
    const planned = ex.sets?.[n - 1];
    const type = planned?.type ?? 'normal';
    // Working sets start from the same set of the last session with this exercise (in any routine):
    // the reps and weight to beat are already in the boxes. Warm-ups keep their planned reps.
    const working = (ex.sets ?? []).slice(0, n).filter((p) => p.type !== 'warmup').length || n;
    const before = type === 'warmup' ? undefined : (ex.last?.sets?.[working - 1] ?? ex.last?.sets?.at(-1));
    s.rows[k] ??= {
      id: crypto.randomUUID(),
      reps: before?.reps ?? planned?.reps ?? ex.targetReps,
      type,
      // A weight written in the routine plan wins; otherwise the last session's, so the number to beat is there.
      weight:
        planned?.weight !== undefined
          ? toDisplay(planned.weight, s.unit)
          : before
            ? toDisplay(before.weight, s.unit)
            : ex.last && type !== 'warmup'
              ? toDisplay(ex.last.weight, s.unit)
              : 0,
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
        endedAt: detail.workout.completedAt ? Date.parse(detail.workout.completedAt) : undefined,
      };
      for (const e of detail.entries) {
        built.rows[rowKey(e.exerciseId, e.setNumber)] = {
          id: e.id,
          reps: e.reps,
          weight: toDisplay(e.weight, u),
          completed: e.completed,
          type: e.setType,
        };
      }
      this.#ensureRows(built);
      await saveSnapshot(built);
      this.snap = built;
    } catch (e) {
      this.error =
        e instanceof ApiRequestError ? e.message : t('workout.notOnDevice');
    }
  }

  /** Brings in what the server knows, without touching sets that still have a pending local change. */
  async #mergeServer() {
    const snap = this.snap;
    if (!snap) return;
    try {
      const detail = await api(`/workouts/${this.#id}`, { schema: workoutDetailSchema, timeoutMs: 6000 });
      if (await sync.outbox.hasPendingRemoval(this.#id)) return;
      const pending = await sync.outbox.pendingSetIds(this.#id);
      for (const e of detail.entries) {
        const k = rowKey(e.exerciseId, e.setNumber);
        const mine = snap.rows[k];
        if (mine && pending.has(mine.id)) continue;
        snap.rows[k] = { id: e.id, reps: e.reps, weight: toDisplay(e.weight, snap.unit), completed: e.completed, type: e.setType };
      }
      if (detail.workout.completedAt) snap.endedAt = Date.parse(detail.workout.completedAt);
      if (detail.workout.status === 'completed' && !snap.editing) snap.status = 'completed';
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
    r.doneAt = completed ? Date.now() : undefined;
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
        setType: r.type ?? 'normal',
      },
    });
    if (completed) {
      // Sets still to do: if the rest runs long, the Coach calls you back to the bar.
      const exercise = snap.exercises.find((e) => e.exerciseId === exerciseId)?.exerciseName;
      restTimer.start(REST_SECONDS, this.pendingSets > 0 ? { exercise } : undefined);
    }
  }

  /** Editing a set that is already completed re-sends it; editing an open one only updates the local copy. */
  async edited(exerciseId: string, setNumber: number) {
    const snap = this.snap;
    const r = snap?.rows[rowKey(exerciseId, setNumber)];
    if (!snap || !r) return;
    if (r.completed) await this.commit(exerciseId, setNumber, true);
    else {
      // Getting the next set ready: no need for the Coach to call you back.
      restTimer.stopNag();
      await saveSnapshot(snap);
    }
  }

  /** The Coach reacts when a working set goes below what it weighed last session (any amount). */
  weightChanged(ex: RoutineExerciseDto, n: number) {
    const r = this.row(ex.exerciseId, n);
    const before = this.lastWeightFor(ex, n);
    if (r && before !== null && r.weight > 0 && r.weight < before) {
      coachSay('weightDrop', { exercise: ex.exerciseName, weight: `${r.weight} ${this.unit}`, reps: r.reps });
    }
  }

  /** Marks a set as warm-up, drop set, to failure or normal; a completed set is re-sent. */
  async retype(exerciseId: string, setNumber: number, type: SetType) {
    const r = this.snap?.rows[rowKey(exerciseId, setNumber)];
    if (!r) return;
    r.type = type;
    await this.edited(exerciseId, setNumber);
  }

  // Changes to the exercise list belong to this workout only: the routine it came from is never touched.

  /** New order of the exercises for this session. */
  async reorder(next: RoutineExerciseDto[]) {
    const snap = this.snap;
    if (!snap) return;
    snap.exercises = next.map((e, i) => ({ ...e, exerciseOrder: i + 1 }));
    await saveSnapshot(snap);
  }

  /** Adds an exercise to this session only (3 sets of 10 to start). */
  async addExercise(ex: { id: string; name: string; primaryMuscle: string; secondaryMuscles: string[] }) {
    const snap = this.snap;
    if (!snap || snap.exercises.some((e) => e.exerciseId === ex.id)) return;
    const added: RoutineExerciseDto = {
      id: crypto.randomUUID(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.primaryMuscle,
      secondaryMuscles: ex.secondaryMuscles,
      targetSets: 3,
      targetReps: 10,
      exerciseOrder: snap.exercises.length + 1,
    };
    snap.exercises = [...snap.exercises, added];
    this.#ensureRows(snap);
    await saveSnapshot(snap);
  }

  /** Swaps an exercise for another in this session; sets already logged for the old one stay in the history. */
  async replaceExercise(oldExerciseId: string, ex: { id: string; name: string; primaryMuscle: string; secondaryMuscles: string[] }) {
    const snap = this.snap;
    if (!snap || snap.exercises.some((e) => e.exerciseId === ex.id)) return;
    snap.exercises = snap.exercises.map((e) =>
      e.exerciseId === oldExerciseId
        ? { ...e, id: crypto.randomUUID(), exerciseId: ex.id, exerciseName: ex.name, muscleGroup: ex.primaryMuscle, secondaryMuscles: ex.secondaryMuscles, last: null, sets: null }
        : e,
    );
    this.#ensureRows(snap);
    await saveSnapshot(snap);
  }

  /** Drops an exercise from this session's list. */
  async removeExercise(exerciseId: string) {
    const snap = this.snap;
    if (!snap) return;
    snap.exercises = snap.exercises.filter((e) => e.exerciseId !== exerciseId);
    await saveSnapshot(snap);
  }

  /** What this set weighed last session (in the user's unit), to compare against; null for warm-ups or no history. */
  lastWeightFor(ex: RoutineExerciseDto, n: number): number | null {
    const r = this.row(ex.exerciseId, n);
    if (!this.snap || !ex.last || r?.type === 'warmup') return null;
    const working = this.setNumbers(ex).filter((k) => k <= n && this.row(ex.exerciseId, k)?.type !== 'warmup').length || n;
    const kg = ex.last.sets?.[working - 1]?.weight ?? ex.last.weight;
    return toDisplay(kg, this.snap.unit);
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

  /** Removes one set from this session; later sets move up one number, here and on the server. Works with no signal. */
  async removeSet(ex: RoutineExerciseDto, n: number) {
    const snap = this.snap;
    if (!snap) return;
    const nums = this.setNumbers(ex);
    const last = nums[nums.length - 1] ?? 0;
    if (nums.length <= 1 || n < 1 || n > last) return;
    for (let k = n; k < last; k++) {
      const next = snap.rows[rowKey(ex.exerciseId, k + 1)];
      if (next) snap.rows[rowKey(ex.exerciseId, k)] = next;
      else delete snap.rows[rowKey(ex.exerciseId, k)];
    }
    delete snap.rows[rowKey(ex.exerciseId, last)];
    snap.exercises = snap.exercises.map((e) =>
      e.exerciseId === ex.exerciseId
        ? { ...e, targetSets: Math.min(e.targetSets, last - 1), sets: e.sets ? e.sets.filter((_, i) => i !== n - 1) : e.sets }
        : e,
    );
    await saveSnapshot(snap);
    await sync.enqueue({ type: 'remove-set', workoutId: this.#id, exerciseId: ex.exerciseId, setNumber: n });
    restTimer.stopNag();
  }

  /** Cancels the workout in progress: nothing of it is kept, here or on the server. Works with no signal. */
  async cancel(): Promise<void> {
    if (!this.snap || this.isCompleted) return;
    this.cancelling = true;
    await cancelWorkoutById(this.#id);
    await goto('/dashboard', { replaceState: true });
  }

  /** Duration of a finished workout, in seconds. */
  get finishedSeconds(): number | null {
    const s = this.snap;
    return s?.endedAt && s.endedAt > s.startedAt ? Math.round((s.endedAt - s.startedAt) / 1000) : null;
  }

  /**
   * Exercises where this session beat the all-time best known when it started (heavier, or as heavy
   * with more reps). Null when there is nothing to compare with (e.g. opened from another device).
   */
  get records(): number | null {
    const exs = (this.snap?.exercises ?? []).filter((e) => e.last?.record);
    if (!exs.length) return null;
    return exs.filter((e) => {
      const rec = e.last!.record!;
      const best = toDisplay(rec.weight, this.unit);
      return this.doneSets(e).some((s) => s.type !== 'warmup' && (s.weight > best || (s.weight === best && s.reps > rec.reps)));
    }).length;
  }

  /** Opens a finished workout to fix sets or duration; saving finishes it again. */
  async reopen() {
    const snap = this.snap;
    if (!snap || snap.status !== 'completed') return;
    snap.status = 'in_progress';
    snap.editing = true;
    await saveSnapshot(snap);
  }

  /** Planned sets still not ticked: finishing with them left is allowed, after a warning. */
  get pendingSets(): number {
    return (this.snap?.exercises ?? []).reduce((n, e) => n + this.progress(e).total - this.progress(e).done, 0);
  }

  /**
   * How long the session took, by the clock, and what we would suggest instead when the clock can't be
   * trusted: a past day (no clock at all), or a timer left running long after the last set.
   */
  get duration(): { clockSeconds: number | null; suggestedSeconds: number; doubtful: boolean } {
    const snap = this.snap;
    if (!snap) return { clockSeconds: null, suggestedSeconds: 0, doubtful: false };
    const rows = Object.values(snap.rows).filter((r) => r.completed);
    const estimate = Math.max(10, Math.round((rows.length * 135 + 300) / 300) * 5) * 60;
    const before = snap.endedAt ? Math.round((snap.endedAt - snap.startedAt) / 1000) : 0;
    if (snap.editing && before > 0) return { clockSeconds: null, suggestedSeconds: before, doubtful: false };
    if (snap.day) return { clockSeconds: null, suggestedSeconds: estimate, doubtful: true };
    const clock = Math.max(60, Math.round((Date.now() - snap.startedAt) / 1000));
    const lastDone = Math.max(0, ...rows.map((r) => r.doneAt ?? 0));
    // Done the last set and walked away: the session ended a few minutes after it, not now.
    const byLastSet = lastDone > snap.startedAt ? Math.round((lastDone - snap.startedAt) / 1000) + 300 : estimate;
    const doubtful = clock > 3 * 3600 || (lastDone > 0 && Date.now() - lastDone > 30 * 60 * 1000);
    return { clockSeconds: clock, suggestedSeconds: doubtful ? Math.min(byLastSet, clock) : clock, doubtful };
  }

  async finish(durationSeconds?: number): Promise<boolean> {
    const snap = this.snap;
    if (!snap) return false;
    if (!this.anyCompleted) {
      this.error = t('workout.logOneSet');
      return false;
    }
    this.finishing = true;
    this.error = null;
    snap.status = 'completed';
    snap.editing = false;
    if (durationSeconds) snap.endedAt = snap.startedAt + durationSeconds * 1000;
    await saveSnapshot(snap);
    await sync.enqueue({ type: 'finish-workout', workoutId: this.#id, durationSeconds });
    await setActiveWorkoutId(null);
    restTimer.skip();
    await goto('/history', { replaceState: true });
    return true;
  }
}
