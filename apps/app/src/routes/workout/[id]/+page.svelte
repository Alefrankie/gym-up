<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import {
    todayWorkoutResponseSchema,
    workoutDetailSchema,
    type RoutineExerciseDto,
  } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { sync } from '#lib/offline/sync.svelte';
  import {
    loadSnapshot,
    rowKey,
    saveSnapshot,
    setActiveWorkoutId,
    type WorkoutSnapshot,
  } from '#lib/offline/workout-session';
  import { session } from '#lib/session';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  const KG_TO_LBS = 2.20462;
  const REST_SECONDS = 90;

  const workoutId = $derived(page.params.id ?? '');
  let snap = $state<WorkoutSnapshot | null>(null);
  let error = $state<string | null>(null);
  let finishing = $state(false);
  let rest = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const unit = $derived(snap?.unit ?? 'kg');
  const isCompleted = $derived(snap?.status === 'completed');
  const toDisplay = (kg: number, u: 'kg' | 'lbs') => (u === 'lbs' ? Math.round(kg * KG_TO_LBS * 10) / 10 : kg);

  /** Sets shown per exercise: the target, or more if the workout already has more. */
  function setNumbers(ex: RoutineExerciseDto): number[] {
    const used = Object.keys(snap?.rows ?? {})
      .filter((k) => k.startsWith(`${ex.exerciseId}:`))
      .map((k) => Number(k.split(':')[1]));
    return Array.from({ length: Math.max(ex.targetSets, ...used, 0) }, (_, i) => i + 1);
  }

  /** Every visible set gets a row (with its own stable id) before the first render of the list. */
  function ensureRows(s: WorkoutSnapshot) {
    for (const ex of s.exercises) {
      const n = Math.max(ex.targetSets, 0);
      for (let i = 1; i <= n; i++) {
        const k = rowKey(ex.exerciseId, i);
        s.rows[k] ??= { id: crypto.randomUUID(), reps: ex.targetReps, weight: 0, completed: false };
      }
    }
  }

  onMount(async () => {
    if (!(await session.require())) return;
    unsubscribe = sync.onRemap((r) => {
      if (r.from === workoutId) void goto(`/workout/${r.to}`, { replaceState: true });
    });

    const local = await loadSnapshot(workoutId);
    if (local) {
      ensureRows(local);
      snap = local;
      void mergeServer(); // best effort; the local copy is already usable
      return;
    }
    await buildFromServer();
  });

  onDestroy(() => {
    clearInterval(timer);
    unsubscribe?.();
  });

  /** Opens a workout this device has no local copy of (history, another device). Needs the server or the cache. */
  async function buildFromServer() {
    try {
      const detail = await api(`/workouts/${workoutId}`, { schema: workoutDetailSchema });
      const today = await cachedGet('/workouts/today', todayWorkoutResponseSchema);
      let exercises: RoutineExerciseDto[] = [];
      let dayName = 'Entrenamiento';
      let u = session.user?.weightUnit ?? 'kg';
      if (today.data.kind === 'workout_day' && today.data.existingWorkoutId === workoutId) {
        exercises = today.data.exercises;
        dayName = today.data.routineDay.dayName;
        u = today.data.weightUnit;
      } else {
        const seen = new Map<string, RoutineExerciseDto>();
        for (const e of detail.entries) {
          if (!seen.has(e.exerciseId)) {
            seen.set(e.exerciseId, {
              id: e.exerciseId, exerciseId: e.exerciseId, exerciseName: e.exerciseName,
              muscleGroup: e.muscleGroup, targetSets: 0, targetReps: 10, exerciseOrder: seen.size + 1,
            });
          }
        }
        exercises = [...seen.values()];
      }
      const built: WorkoutSnapshot = {
        workoutId, routineDayId: detail.workout.routineDayId, dayName, exercises, rows: {},
        status: detail.workout.status, unit: u, startedAt: Date.parse(detail.workout.startedAt),
      };
      for (const e of detail.entries) {
        built.rows[rowKey(e.exerciseId, e.setNumber)] = {
          id: e.id, reps: e.reps, weight: toDisplay(e.weight, u), completed: e.completed,
        };
      }
      ensureRows(built);
      await saveSnapshot(built);
      snap = built;
    } catch (e) {
      error =
        e instanceof ApiRequestError
          ? e.message
          : 'Sin conexión. Este entrenamiento no está guardado en el teléfono.';
    }
  }

  /** Brings in what the server knows, without touching sets that still have a pending local change. */
  async function mergeServer() {
    if (!snap) return;
    try {
      const detail = await api(`/workouts/${workoutId}`, { schema: workoutDetailSchema, timeoutMs: 6000 });
      const pending = await sync.outbox.pendingSetIds(workoutId);
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

  function startRest() {
    clearInterval(timer);
    rest = REST_SECONDS;
    timer = setInterval(() => {
      rest -= 1;
      if (rest <= 0) clearInterval(timer);
    }, 1000);
  }

  /** Writes the local copy, then queues the change for the server. Works with no signal. */
  async function commit(exerciseId: string, setNumber: number, completed: boolean) {
    if (!snap) return;
    const r = snap.rows[rowKey(exerciseId, setNumber)];
    if (!r) return;
    r.completed = completed;
    await saveSnapshot(snap);
    await sync.enqueue({
      type: 'upsert-set',
      workoutId,
      set: {
        id: r.id, exerciseId, setNumber, reps: r.reps, weight: r.weight,
        weightUnit: snap.unit, completed, notes: null,
      },
    });
    if (completed) startRest();
  }

  /** Editing a set that is already completed re-sends it; editing an open one only updates the local copy. */
  async function edited(exerciseId: string, setNumber: number) {
    if (!snap) return;
    const r = snap.rows[rowKey(exerciseId, setNumber)];
    if (!r) return;
    if (r.completed) await commit(exerciseId, setNumber, true);
    else await saveSnapshot(snap);
  }

  async function finish() {
    if (!snap) return;
    if (!Object.values(snap.rows).some((r) => r.completed)) {
      error = 'Registra al menos una serie antes de finalizar';
      return;
    }
    finishing = true;
    error = null;
    snap.status = 'completed';
    await saveSnapshot(snap);
    await sync.enqueue({ type: 'finish-workout', workoutId });
    await setActiveWorkoutId(null);
    await goto('/history', { replaceState: true });
  }
</script>

<main>
  <p><a href="/dashboard">← Inicio</a></p>
  <h1>{snap?.dayName ?? 'Entrenamiento'}</h1>
  <SyncBanner />
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !snap && !error}<p class="muted">Cargando…</p>{/if}

  {#if rest > 0}
    <div class="rest" role="timer">
      Descanso {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
      <button type="button" onclick={() => (rest = 0)}>Omitir</button>
    </div>
  {/if}

  {#if snap}
    {#each snap.exercises as ex (ex.exerciseId)}
      <section class="card">
        <h2>{ex.exerciseName}</h2>
        <p class="muted">{ex.muscleGroup}{ex.targetSets ? ` · ${ex.targetSets} x ${ex.targetReps}` : ''}</p>
        <div class="sets">
          {#each setNumbers(ex) as n (n)}
            {@const r = snap.rows[rowKey(ex.exerciseId, n)]}
            {#if r}
              <div class="set" class:done={r.completed}>
                <span class="n">{n}</span>
                <input
                  type="number" inputmode="decimal" min="0" step="0.5"
                  bind:value={r.weight} disabled={isCompleted}
                  onchange={() => edited(ex.exerciseId, n)}
                  aria-label="Peso ({unit})"
                />
                <span class="muted">{unit}</span>
                <input
                  type="number" inputmode="numeric" min="1" max="100"
                  bind:value={r.reps} disabled={isCompleted}
                  onchange={() => edited(ex.exerciseId, n)}
                  aria-label="Repeticiones"
                />
                <span class="muted">reps</span>
                <button
                  type="button" class="check" disabled={isCompleted}
                  onclick={() => commit(ex.exerciseId, n, !r.completed)}
                  aria-label={r.completed ? 'Desmarcar serie' : 'Completar serie'}
                >{r.completed ? '✓' : '○'}</button>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/each}

    {#if !isCompleted}
      <button class="primary" disabled={finishing} onclick={finish}>
        {finishing ? 'Finalizando…' : 'Finalizar entrenamiento'}
      </button>
    {:else}
      <p class="ok">Entrenamiento completado</p>
    {/if}
  {/if}
</main>
