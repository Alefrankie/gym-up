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
  import { muscleLoad } from '#lib/muscle-load';
  import ExerciseRow from '#lib/components/ExerciseRow.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';
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
      const first = t.exercises[0]?.exerciseId;
      await goto(first ? `/workout/${id}/${first}` : `/workout/${id}`);
    } catch {
      error = 'No se pudo iniciar el entrenamiento';
      busy = false;
    }
  }
</script>

<main>
  <SyncBanner />
  {#if stale}
    <p class="muted">Sin conexión: mostrando tu última rutina descargada.</p>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !today && !error}
    <p class="hello">Hola{session.user ? `, ${session.user.displayName}` : ''}</p>
    <section class="card hero skeleton" aria-busy="true"><span class="muted">Cargando tu rutina…</span></section>
  {:else if today?.kind === 'no_routine'}
    <p class="hello">Hola{session.user ? `, ${session.user.displayName}` : ''}</p>
    <section class="card hero">
      <h2>Aún no tienes un programa</h2>
      <p class="muted">Elige una plantilla o crea el tuyo y aquí verás qué toca hoy.</p>
      <a class="cta-link" href="/programs">Ver programas <Icon name="right" size={18} /></a>
    </section>
  {:else if today?.kind === 'rest_day'}
    <p class="hello">Hola{session.user ? `, ${session.user.displayName}` : ''}</p>
    <section class="card hero">
      <h2>Hoy es día de descanso</h2>
      <p class="muted">Tus rutinas:</p>
      <ul class="list">
        {#each today.dayOptions as day}
          <li><div class="row-body"><span class="grow"><strong>{day.dayName}</strong><span class="muted">{day.focus}</span></span></div></li>
        {/each}
      </ul>
    </section>
  {:else if today?.kind === 'workout_day'}
    {@const t = today}
    {@const done = t.workoutStatus === 'completed' && !activeWorkoutId}
    <p class="hello">
      Hola{session.user ? `, ${session.user.displayName}` : ''}
      {#if t.programName}<span class="badge">{t.programName}</span>{/if}
    </p>
    <h1 class="title">{t.routineDay.dayName}</h1>
    <p class="muted focus">{t.routineDay.focus}</p>

    <TargetMuscles muscles={muscleLoad(t.exercises)} />

    <h2>{t.exercises.length} {t.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</h2>
    <ul class="rows">
      {#each t.exercises as ex (ex.id)}
        <li><ExerciseRow {ex} unit={t.weightUnit} /></li>
      {/each}
    </ul>

    <div class="cta">
      {#if done}
        <p class="ok done"><Icon name="check" size={20} /> Entrenamiento completado hoy</p>
      {:else}
        <button class="primary go" disabled={busy} onclick={() => start(t)}>
          <Icon name="bolt" size={22} />
          {t.workoutStatus === 'in_progress' || activeWorkoutId ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
        </button>
      {/if}
    </div>
  {/if}
</main>

<AppNav />

<style>
  .hello {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 1rem 0 0;
    color: var(--muted);
    font-weight: 500;
  }
  .title {
    margin: 0.3rem 0 0.1rem;
    font-size: 2.6rem;
  }
  .focus {
    margin: 0;
  }
  .rows {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.7rem;
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(4.9rem + env(safe-area-inset-bottom));
    padding: 1.2rem 1rem 0.5rem;
    background: linear-gradient(180deg, transparent, var(--bg) 60%);
    pointer-events: none;
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    max-width: 22rem;
    margin: 0 auto;
    min-height: 56px;
    border-radius: 999px;
    pointer-events: auto;
  }
  .done {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin: 0;
    pointer-events: auto;
  }
  .cta-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 700;
  }
  .skeleton {
    min-height: 12rem;
    display: grid;
    place-items: center;
  }
</style>
