<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    startWorkoutResponseSchema,
    todayWorkoutResponseSchema,
    type TodayWorkoutResponse,
  } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';

  let today = $state<TodayWorkoutResponse | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      today = await api('/workouts/today', { schema: todayWorkoutResponseSchema });
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo cargar el entrenamiento de hoy';
    }
  });

  async function start(routineDayId: string, existingWorkoutId: string | null) {
    busy = true;
    error = null;
    try {
      const res = await api('/workouts', {
        body: { id: crypto.randomUUID(), routineDayId, existingWorkoutId: existingWorkoutId ?? undefined },
        schema: startWorkoutResponseSchema,
      });
      await goto(`/workout/${res.workout.id}`);
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo iniciar el entrenamiento';
      busy = false;
    }
  }
</script>

<main>
  <h1>Hola{session.user ? `, ${session.user.displayName}` : ''}</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !today && !error}
    <p class="muted">Cargando…</p>
  {:else if today?.kind === 'no_routine'}
    <p>Aún no tienes una rutina asignada.</p>
  {:else if today?.kind === 'rest_day'}
    <h2>Hoy es día de descanso</h2>
    <p class="muted">También puedes elegir un día:</p>
    <ul class="list">
      {#each today.dayOptions as day}
        <li><strong>{day.dayName}</strong> <span class="muted">{day.focus}</span></li>
      {/each}
    </ul>
  {:else if today?.kind === 'workout_day'}
    {@const t = today}
    <section class="card">
      <h2>{today.routineDay.dayName}</h2>
      <p class="muted">{today.routineDay.focus}</p>
      <ul class="list">
        {#each today.exercises as ex}
          <li>
            <strong>{ex.exerciseName}</strong>
            <span class="muted">{ex.targetSets} x {ex.targetReps}</span>
          </li>
        {/each}
      </ul>
      {#if today.workoutStatus === 'completed'}
        <p class="ok">Entrenamiento completado hoy</p>
      {:else}
        <button
          class="primary"
          disabled={busy}
          onclick={() => start(t.routineDay.id, t.existingWorkoutId)}
        >
          {today.workoutStatus === 'in_progress' ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
        </button>
      {/if}
    </section>
  {/if}
</main>

<AppNav />
