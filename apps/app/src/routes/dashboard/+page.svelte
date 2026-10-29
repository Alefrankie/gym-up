<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { todayWorkoutResponseSchema, type TodayWorkoutResponse } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { getActiveWorkoutId } from '#lib/offline/workout-session';
  import { beginWorkout } from '#lib/offline/start-workout';
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
    void getActiveWorkoutId().then((id) => (activeWorkoutId = id));
    try {
      const res = await cachedGet('/workouts/today', todayWorkoutResponseSchema, { onCached: (c) => (today = c.data) });
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

  /** Starts (or resumes) today's workout and opens the chosen exercise, or the first one. */
  async function start(t: Extract<TodayWorkoutResponse, { kind: 'workout_day' }>, exerciseId?: string) {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const id = await beginWorkout(t);
      const first = exerciseId ?? t.exercises[0]?.exerciseId;
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
    <section class="card hero skeleton loading" aria-busy="true"><span class="muted">Cargando tu rutina…</span></section>
  {:else if today?.kind === 'no_routine'}
    <p class="hello">Hola{session.user ? `, ${session.user.displayName}` : ''}</p>
    <section class="card hero">
      <h2>Aún no tienes un programa</h2>
      <p class="muted">Elige una plantilla o crea el tuyo y aquí verás qué toca hoy.</p>
      <a class="cta-link" href="/programs">Ver programas <Icon name="right" size={16} /></a>
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
    {#if t.week && t.week.target > 0}
      <div class="week" aria-label={`${t.week.done} de ${t.week.target} entrenamientos esta semana`}>
        <div class="bars">
          {#each Array.from({ length: t.week.target }, (_, i) => i) as i (i)}
            <span class:on={i < t.week.done}></span>
          {/each}
        </div>
        <span class="muted">{Math.min(t.week.done, t.week.target)} de {t.week.target} esta semana</span>
      </div>
    {/if}
    <h1 class="title">{t.routineDay.dayName}</h1>
    <p class="muted focus">{t.routineDay.focus}</p>
    {@const sets = t.exercises.reduce((n, e) => n + e.targetSets, 0)}
    {@const mins = Math.max(5, Math.round(t.exercises.reduce((n, e) => n + e.targetSets * ((e.restSeconds ?? 90) + 45), 0) / 300) * 5)}
    <p class="meta">≈ {mins} min · {t.exercises.length} ejercicios · {sets} series</p>

    <TargetMuscles muscles={muscleLoad(t.exercises)} />

    <h2>{t.exercises.length} {t.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</h2>
    <ul class="rows">
      {#each t.exercises as ex (ex.id)}
        <li><ExerciseRow {ex} unit={t.weightUnit} onclick={done ? undefined : () => start(t, ex.exerciseId)} /></li>
      {/each}
    </ul>

    <div class="cta">
      {#if done}
        <p class="ok done"><Icon name="check" size={16} /> Entrenamiento completado hoy</p>
      {:else}
        <button class="primary go" disabled={busy} onclick={() => start(t)}>
          <Icon name="bolt" size={18} />
          {t.workoutStatus === 'in_progress' || activeWorkoutId ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
        </button>
      {/if}
    </div>
  {/if}
</main>

<AppNav />

<style>
  .week {
    display: grid;
    gap: 0.4rem;
    margin: 0.75rem 0 1.25rem;
    font-size: var(--t-sm);
  }
  .bars {
    display: flex;
    gap: 0.35rem;
  }
  .bars span {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--raised);
    transition: background-color 300ms var(--ease);
  }
  .bars span.on {
    background: var(--accent);
  }
  .meta {
    margin: 0.35rem 0 0;
    color: var(--text);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .hello {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.75rem 0 0;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .title {
    margin: 0.25rem 0 0.1rem;
    font-size: var(--t-xl);
  }
  .focus {
    margin: 0 0 1rem;
    font-size: var(--t-sm);
  }
  .rows {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(4.9rem + env(safe-area-inset-bottom));
    padding: 0.75rem 1rem 0.5rem;
    background: linear-gradient(180deg, transparent, var(--bg) 45%);
    pointer-events: none;
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    max-width: 14rem;
    margin: 0 auto;
    min-height: 48px;
    pointer-events: auto;
  }
  .done {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin: 0;
    font-size: var(--t-sm);
    pointer-events: auto;
  }
  .cta-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .skeleton {
    min-height: 8rem;
    display: grid;
    place-items: center;
  }
</style>
