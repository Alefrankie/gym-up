<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { todayWorkoutResponseSchema, type TodayWorkoutResponse } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { getActiveWorkoutId, saveSnapshot, setActiveWorkoutId } from '#lib/offline/workout-session';
  import { sync } from '#lib/offline/sync.svelte';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  let today = $state<TodayWorkoutResponse | null>(null);
  let stale = $state(false);
  let activeWorkoutId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    activeWorkoutId = await getActiveWorkoutId();
    try {
      const res = await cachedGet('/workouts/today', todayWorkoutResponseSchema);
      today = res.data;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y todavía no hay datos guardados. Conéctate una vez para descargar tu rutina.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo cargar el entrenamiento de hoy';
    }
  });

  /**
   * Starts locally first: the workout exists on this device immediately (id generated here, exercises from
   * the last copy of today's routine), and the `start-workout` command reaches the server whenever there is signal.
   */
  async function start(t: Extract<TodayWorkoutResponse, { kind: 'workout_day' }>) {
    busy = true;
    error = null;
    try {
      const id = t.existingWorkoutId ?? activeWorkoutId ?? crypto.randomUUID();
      if (!t.existingWorkoutId && !activeWorkoutId) {
        await saveSnapshot({
          workoutId: id,
          routineDayId: t.routineDay.id,
          dayName: t.routineDay.dayName,
          exercises: t.exercises,
          rows: {},
          status: 'in_progress',
          unit: t.weightUnit,
          startedAt: Date.now(),
        });
        await sync.enqueue({ type: 'start-workout', id, routineDayId: t.routineDay.id });
      }
      await setActiveWorkoutId(id);
      await goto(`/workout/${id}`);
    } catch {
      error = 'No se pudo iniciar el entrenamiento';
      busy = false;
    }
  }
</script>

<main>
  <h1>Hola{session.user ? `, ${session.user.displayName}` : ''}</h1>
  <SyncBanner />
  {#if stale}
    <p class="muted">Sin conexión: mostrando tu última rutina descargada.</p>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !today && !error}
    <p class="muted">Cargando…</p>
  {:else if today?.kind === 'no_routine'}
    <p>Aún no tienes una rutina asignada.</p>
  {:else if today?.kind === 'rest_day'}
    <h2>Hoy es día de descanso</h2>
    <p class="muted">Tus días de rutina:</p>
    <ul class="list">
      {#each today.dayOptions as day}
        <li><strong>{day.dayName}</strong> <span class="muted">{day.focus}</span></li>
      {/each}
    </ul>
  {:else if today?.kind === 'workout_day'}
    {@const t = today}
    <section class="card">
      <h2>{t.routineDay.dayName}</h2>
      <p class="muted">{t.routineDay.focus}</p>
      <ul class="list">
        {#each t.exercises as ex}
          <li>
            <strong>{ex.exerciseName}</strong>
            <span class="muted">{ex.targetSets} x {ex.targetReps}</span>
          </li>
        {/each}
      </ul>
      {#if t.workoutStatus === 'completed' && !activeWorkoutId}
        <p class="ok">Entrenamiento completado hoy</p>
      {:else}
        <button class="primary" disabled={busy} onclick={() => start(t)}>
          {t.workoutStatus === 'in_progress' || activeWorkoutId ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
        </button>
      {/if}
    </section>
  {/if}
  <p class="muted"><a href="/history">Ver historial de entrenamientos</a></p>
</main>

<AppNav />
