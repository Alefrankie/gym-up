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
  import { cancelRestEnd, scheduleRestEnd, vibrateRestEnd } from '#lib/notify';
  import { session } from '#lib/session';
  import { muscle } from '#lib/labels';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';
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

  const ago = (iso: string) => {
    const days = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
    return days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
  };

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
        s.rows[k] ??= {
          id: crypto.randomUUID(),
          reps: ex.targetReps,
          // Start from what you lifted last time: the number to beat is already in the box.
          weight: ex.last ? toDisplay(ex.last.weight, s.unit) : 0,
          completed: false,
        };
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
    void scheduleRestEnd(REST_SECONDS);
    timer = setInterval(() => {
      rest -= 1;
      if (rest <= 0) {
        clearInterval(timer);
        vibrateRestEnd();
      }
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
  <p><a class="back" href="/dashboard"><Icon name="left" size={18} /> Inicio</a></p>
  <h1>{snap?.dayName ?? 'Entrenamiento'}</h1>
  <SyncBanner />
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !snap && !error}<p class="muted">Cargando…</p>{/if}

  {#if rest > 0}
    <div class="rest" role="timer">
      <span class="clock"><Icon name="timer" size={22} /> Descanso {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</span>
      <button type="button" class="skip" onclick={() => { rest = 0; clearInterval(timer); void cancelRestEnd(); }}>Omitir</button>
    </div>
  {/if}

  {#if snap}
    {#each snap.exercises as ex (ex.exerciseId)}
      <section class="card">
        <header>
          <MuscleFigure primary={ex.muscleGroup} size={30} />
          <div class="titles">
            <h2>{ex.exerciseName}</h2>
            <span class="muted">{muscle(ex.muscleGroup)}{ex.targetSets ? ` · objetivo ${ex.targetSets} × ${ex.targetReps}` : ''}</span>
          </div>
        </header>
        {#if ex.last}
          <p class="last">
            <Icon name="history" size={18} />
            <span>
              {ago(ex.last.date) === 'hoy' ? 'Hoy' : ago(ex.last.date)[0]!.toUpperCase() + ago(ex.last.date).slice(1)}:
              <strong>{toDisplay(ex.last.weight, unit)} {unit} × {ex.last.reps}</strong>
            </span>
          </p>
        {:else}
          <p class="last none">Primera vez con este ejercicio</p>
        {/if}
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
                <span class="unit">{unit}</span>
                <input
                  type="number" inputmode="numeric" min="1" max="100"
                  bind:value={r.reps} disabled={isCompleted}
                  onchange={() => edited(ex.exerciseId, n)}
                  aria-label="Repeticiones"
                />
                <span class="unit">reps</span>
                <button
                  type="button" class="check" disabled={isCompleted}
                  onclick={() => commit(ex.exerciseId, n, !r.completed)}
                  aria-label={r.completed ? 'Desmarcar serie' : 'Completar serie'}
                ><Icon name="check" size={22} /></button>
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

<style>
  .rest {
    gap: 0.75rem;
  }
  .clock {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.4rem;
  }
  .skip {
    min-height: 40px;
    padding: 0 0.9rem;
    background: rgb(28 13 5 / 0.18);
    box-shadow: none;
    color: var(--accent-ink);
  }
  section header {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  section h2 {
    margin: 0;
  }
  .titles {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }
  .last {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.8rem 0 0;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--ember);
  }
  .last strong {
    color: var(--text);
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .last.none {
    background: var(--bg);
    color: var(--muted);
  }
  .n {
    color: var(--muted);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.2rem;
    text-align: center;
  }
  .unit {
    color: var(--muted);
    font-size: 0.8rem;
  }
  .set input {
    text-align: center;
    font-weight: 700;
    font-size: 1.15rem;
  }
  .check {
    display: grid;
    place-items: center;
    background: var(--bg);
    box-shadow: 0 0 0 1px var(--line) inset, 0 2px 4px rgb(0 0 0 / 0.35) inset;
    color: var(--muted);
  }
  .set.done .check {
    background: linear-gradient(180deg, #a9dc83, var(--ok));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.4) inset, 0 8px 16px -8px rgb(143 203 107 / 0.7);
    color: #12220a;
  }
</style>
