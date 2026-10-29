<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import {
    todayWorkoutResponseSchema,
    workoutDetailSchema,
    workoutEntrySchema,
    type RoutineExerciseDto,
    type WorkoutDetailDto,
  } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { session } from '#lib/session';

  const KG_TO_LBS = 2.20462;
  const REST_SECONDS = 90;

  interface SetRow {
    id: string;
    reps: number;
    weight: number; // in the user's unit
    completed: boolean;
    saving: boolean;
  }

  const workoutId = $derived(page.params.id ?? '');
  let detail = $state<WorkoutDetailDto | null>(null);
  let exercises = $state<RoutineExerciseDto[]>([]);
  let rows = $state<Record<string, SetRow>>({});
  let error = $state<string | null>(null);
  let finishing = $state(false);
  let rest = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  const unit = $derived(session.user?.weightUnit ?? 'kg');
  const key = (exerciseId: string, setNumber: number) => `${exerciseId}:${setNumber}`;
  const toDisplay = (kg: number) => (unit === 'lbs' ? Math.round(kg * KG_TO_LBS * 10) / 10 : kg);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      detail = await api(`/workouts/${workoutId}`, { schema: workoutDetailSchema });
      const today = await api('/workouts/today', { schema: todayWorkoutResponseSchema });
      if (today.kind === 'workout_day' && today.existingWorkoutId === workoutId) {
        exercises = today.exercises;
      } else {
        // Past workout: only the exercises that have sets are known.
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
      for (const e of detail.entries) {
        rows[key(e.exerciseId, e.setNumber)] = {
          id: e.id, reps: e.reps, weight: toDisplay(e.weight), completed: e.completed, saving: false,
        };
      }
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo cargar el entrenamiento';
    }
  });

  onDestroy(() => clearInterval(timer));

  function row(exerciseId: string, setNumber: number, targetReps: number): SetRow {
    const k = key(exerciseId, setNumber);
    return (rows[k] ??= { id: crypto.randomUUID(), reps: targetReps, weight: 0, completed: false, saving: false });
  }

  function startRest() {
    clearInterval(timer);
    rest = REST_SECONDS;
    timer = setInterval(() => {
      rest -= 1;
      if (rest <= 0) clearInterval(timer);
    }, 1000);
  }

  /** Saves one set. The id is generated once per set, so a retry never creates a duplicate. */
  async function save(exerciseId: string, setNumber: number, completed: boolean) {
    const r = rows[key(exerciseId, setNumber)];
    if (!r) return;
    r.saving = true;
    error = null;
    try {
      await api(`/workouts/${workoutId}/sets`, {
        method: 'PUT',
        body: { id: r.id, exerciseId, setNumber, reps: r.reps, weight: r.weight, weightUnit: unit, completed, notes: null },
        schema: workoutEntrySchema,
      });
      r.completed = completed;
      if (completed) startRest();
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo guardar la serie';
    } finally {
      r.saving = false;
    }
  }

  async function finish() {
    finishing = true;
    error = null;
    try {
      await api(`/workouts/${workoutId}/complete`, { method: 'POST' });
      await goto('/history', { replaceState: true });
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo finalizar';
      finishing = false;
    }
  }

  const isCompleted = $derived(detail?.workout.status === 'completed');
</script>

<main>
  <p><a href="/dashboard">← Inicio</a></p>
  <h1>Entrenamiento</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !detail && !error}<p class="muted">Cargando…</p>{/if}

  {#if rest > 0}
    <div class="rest" role="timer">Descanso {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
      <button type="button" onclick={() => (rest = 0)}>Omitir</button>
    </div>
  {/if}

  {#each exercises as ex (ex.exerciseId)}
    <section class="card">
      <h2>{ex.exerciseName}</h2>
      <p class="muted">{ex.muscleGroup}{ex.targetSets ? ` · ${ex.targetSets} x ${ex.targetReps}` : ''}</p>
      <div class="sets">
        {#each Array.from({ length: Math.max(ex.targetSets, ...Object.keys(rows).filter((k) => k.startsWith(ex.exerciseId + ':')).map((k) => Number(k.split(':')[1]))) }, (_, i) => i + 1) as n}
          {@const r = row(ex.exerciseId, n, ex.targetReps)}
          <div class="set" class:done={r.completed}>
            <span class="n">{n}</span>
            <input type="number" inputmode="decimal" min="0" step="0.5" bind:value={r.weight} disabled={isCompleted} aria-label="Peso ({unit})" />
            <span class="muted">{unit}</span>
            <input type="number" inputmode="numeric" min="1" max="100" bind:value={r.reps} disabled={isCompleted} aria-label="Repeticiones" />
            <span class="muted">reps</span>
            <button
              type="button"
              class="check"
              disabled={r.saving || isCompleted}
              onclick={() => save(ex.exerciseId, n, !r.completed)}
              aria-label={r.completed ? 'Desmarcar serie' : 'Completar serie'}
            >{r.completed ? '✓' : '○'}</button>
          </div>
        {/each}
      </div>
    </section>
  {/each}

  {#if detail && !isCompleted}
    <button class="primary" disabled={finishing} onclick={finish}>{finishing ? 'Finalizando…' : 'Finalizar entrenamiento'}</button>
  {:else if isCompleted}
    <p class="ok">Entrenamiento completado</p>
  {/if}
</main>
