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
  import { muscle } from '#lib/labels';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';
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
  const disp = (kg: number, u: 'kg' | 'lbs') => (u === 'lbs' ? Math.round(kg * 2.20462 * 10) / 10 : kg);
  /** Distinct muscles the routine works, in order of appearance. */
  /**
   * Share of the session each muscle takes: a set counts fully for the primary muscle and half for each secondary,
   * normalised so the most worked muscle reads 100 %.
   */
  const muscles = (t: Extract<TodayWorkoutResponse, { kind: 'workout_day' }>) => {
    const load = new Map<string, number>();
    for (const e of t.exercises) {
      load.set(e.muscleGroup, (load.get(e.muscleGroup) ?? 0) + e.targetSets);
      for (const m of e.secondaryMuscles ?? []) load.set(m, (load.get(m) ?? 0) + e.targetSets * 0.5);
    }
    const top = Math.max(1, ...load.values());
    return [...load.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([m, v]) => ({ muscle: m, pct: Math.round((v / top) * 100) }));
  };
</script>

<main>
  <h1>Hola{session.user ? `, ${session.user.displayName}` : ''}</h1>
  <SyncBanner />
  {#if stale}
    <p class="muted">Sin conexión: mostrando tu última rutina descargada.</p>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !today && !error}
    <section class="card hero skeleton" aria-busy="true"><span class="muted">Cargando tu rutina…</span></section>
  {:else if today?.kind === 'no_routine'}
    <section class="card hero">
      <h2>Aún no tienes un programa</h2>
      <p class="muted">Elige una plantilla o crea el tuyo y aquí verás qué toca hoy.</p>
      <a class="cta" href="/programs">Ver programas <Icon name="right" size={18} /></a>
    </section>
  {:else if today?.kind === 'rest_day'}
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
    <section class="card hero today">
      <div class="top">
        {#if t.programName}<span class="badge">{t.programName}</span>{/if}
        <span class="muted">Rutina {t.dayNumber}</span>
      </div>
      <h2 class="name">{t.routineDay.dayName}</h2>
      <p class="muted focus">{t.routineDay.focus}</p>
      <div class="figs">
        {#each muscles(t) as m}
          <span class="fig">
            <MuscleFigure primary={m.muscle} size={34} />
            <span>{muscle(m.muscle)}</span>
            <b class:full={m.pct === 100}>{m.pct}%</b>
          </span>
        {/each}
      </div>
      {#if done}
        <p class="ok done"><Icon name="check" size={20} /> Entrenamiento completado hoy</p>
      {:else}
        <button class="primary go" disabled={busy} onclick={() => start(t)}>
          <Icon name="bolt" size={22} />
          {t.workoutStatus === 'in_progress' || activeWorkoutId ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
        </button>
      {/if}
    </section>

    <h2>Lo que toca</h2>
    <ul class="list">
      {#each t.exercises as ex (ex.id)}
        <li>
          <div class="row-body">
            <MuscleFigure primary={ex.muscleGroup} size={24} />
            <span class="grow">
              <strong>{ex.exerciseName}</strong>
              <span class="muted">
                {ex.targetSets} × {ex.targetReps}
              </span>
            </span>
            {#if ex.last}
              <span class="last" title="La última vez">
                <small>Última vez</small>
                <b>{disp(ex.last.weight, t.weightUnit)} {t.weightUnit} × {ex.last.reps}</b>
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .today .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .name {
    font-size: 2.6rem;
    margin: 0.6rem 0 0.1rem;
  }
  .focus {
    margin: 0 0 1rem;
  }
  .figs {
    display: flex;
    gap: 0.9rem;
    margin-bottom: 1.1rem;
  }
  .fig {
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .fig b {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 800;
    color: var(--ember);
  }
  .fig b.full {
    color: var(--ok);
  }
  .go {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0;
    min-height: 56px;
  }
  .done {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
  }
  .last {
    display: grid;
    justify-items: end;
    text-align: right;
  }
  .last small {
    color: var(--muted);
    font-size: 0.7rem;
  }
  .last b {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--ember);
    white-space: nowrap;
  }
  .cta {
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
