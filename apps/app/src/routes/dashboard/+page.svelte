<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    calendarResponseSchema,
    todayWorkoutResponseSchema,
    workoutHistoryResponseSchema,
    type CalendarDayDto,
    type TodayWorkoutResponse,
    type WorkoutHistoryItemDto,
  } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { longDate } from '#lib/dates';
  import { muscleLoad } from '#lib/muscle-load';
  import { cachedGet } from '#lib/offline/cache';
  import { getActiveWorkoutId, loadSnapshot } from '#lib/offline/workout-session';
  import { beginWorkout } from '#lib/offline/start-workout';
  import { session } from '#lib/session';
  import { sessionSummary } from '#lib/workout-math';
  import ActiveWorkoutCard from '#lib/components/ActiveWorkoutCard.svelte';
  import AppNav from '#lib/components/AppNav.svelte';
  import ColumnChart from '#lib/components/ColumnChart.svelte';
  import ExerciseRow from '#lib/components/ExerciseRow.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import SupplementsCard from '#lib/components/SupplementsCard.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';
  import WorkoutHistoryRow from '#lib/components/WorkoutHistoryRow.svelte';

  let today = $state<TodayWorkoutResponse | null>(null);
  let stale = $state(false);
  let live = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let showExercises = $state(false);
  let calendar = $state<CalendarDayDto[]>([]);
  let recent = $state<WorkoutHistoryItemDto[]>([]);

  const dateLabel = longDate().replace(/^./, (c) => c.toUpperCase());

  onMount(async () => {
    if (!(await session.require())) return;
    // A workout under way takes the top card; then today's routine would only repeat it.
    void getActiveWorkoutId().then(async (id) => {
      const s = id ? await loadSnapshot(id) : undefined;
      live = !!s && s.status === 'in_progress';
    });
    // Charts and history fill in as they arrive; none of them blocks the screen.
    void cachedGet('/progress/calendar?days=56', calendarResponseSchema, { onCached: (c) => (calendar = c.data) })
      .then((r) => (calendar = r.data))
      .catch(() => {});
    void cachedGet('/workouts?page=1', workoutHistoryResponseSchema, { onCached: (c) => (recent = c.data.items.slice(0, 3)) })
      .then((r) => (recent = r.data.items.slice(0, 3)))
      .catch(() => {});
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

  /** Workouts per week over the last 8 weeks (Monday-first weeks, oldest first). */
  const perWeek = $derived.by(() => {
    const on = calendar.filter((d) => d.hasWorkout).map((d) => d.date);
    const now = new Date();
    const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return Array.from({ length: 8 }, (_, i) => {
      const from = new Date(monday);
      from.setUTCDate(monday.getUTCDate() - (7 - i) * 7);
      const to = new Date(from);
      to.setUTCDate(from.getUTCDate() + 7);
      const a = from.toISOString().slice(0, 10);
      const b = to.toISOString().slice(0, 10);
      return { label: String(from.getUTCDate()), value: on.filter((d) => d >= a && d < b).length };
    });
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
  <header class="top">
    <p class="date">{dateLabel}</p>
    <h1>Hola{session.user ? `, ${session.user.displayName.split(' ')[0]}` : ''}</h1>
    {#if today?.kind === 'workout_day' && today.programName}
      <a class="program" href="/programs"><Icon name="dumbbell" size={14} />{today.programName}</a>
    {/if}
  </header>

  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando lo último descargado.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <ActiveWorkoutCard oncancelled={() => location.reload()} />

  {#if !live}
    {#if today?.kind === 'workout_day'}
      {@const t = today}
      {#if t.workoutStatus === 'completed'}
        <a class="today done" href={t.existingWorkoutId ? `/workout/${t.existingWorkoutId}` : '/history'}>
          <span class="label ok"><Icon name="check" size={14} /> Hecho hoy</span>
          <strong>{t.routineDay.dayName}</strong>
          <span class="muted">Ver el resumen</span>
        </a>
      {:else}
        <section class="today">
          <span class="label">Hoy toca</span>
          <strong>{t.routineDay.dayName}</strong>
          <span class="meta">{t.routineDay.focus ? `${t.routineDay.focus} · ` : ''}{sessionSummary(t.exercises)}</span>
          <TargetMuscles muscles={muscleLoad(t.exercises)} />
          <div class="actions">
            <button type="button" class="ghost toggle" aria-expanded={showExercises} onclick={() => (showExercises = !showExercises)}>
              {showExercises ? 'Ocultar ejercicios' : 'Ver ejercicios'} <Icon name={showExercises ? 'up' : 'down'} size={16} />
            </button>
            <button class="primary go" disabled={busy} onclick={() => start(t)}><Icon name="bolt" size={16} /> Empezar</button>
          </div>
          {#if showExercises}
            <ul class="rows" transition:slide={{ duration: 240, easing: cubicOut }}>
              {#each t.exercises as ex (ex.id)}
                <li><ExerciseRow {ex} unit={t.weightUnit} onclick={() => start(t, ex.exerciseId)} /></li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    {:else if today?.kind === 'no_routine'}
      <a class="today" href="/programs">
        <span class="label">Empieza aquí</span>
        <strong>Elige un programa</strong>
        <span class="muted">Usa una plantilla o crea el tuyo y aquí verás qué toca cada día.</span>
      </a>
    {:else if today?.kind === 'rest_day'}
      <section class="today">
        <span class="label">Hoy</span>
        <strong>Día de descanso</strong>
      </section>
    {/if}
  {/if}

  <SupplementsCard />

  {#if today?.kind === 'workout_day' && today.week && today.week.target > 0}
    {@const w = today.week}
    <section class="block">
      <div class="block-head"><h2>Esta semana</h2><span class="muted">{Math.min(w.done, w.target)} de {w.target} entrenos</span></div>
      <div class="bars">
        {#each Array.from({ length: w.target }, (_, i) => i) as i (i)}<span class:on={i < w.done}></span>{/each}
      </div>
    </section>
  {/if}

  {#if calendar.length}
    <section class="block card">
      <div class="block-head"><h2>Entrenos por semana</h2><a href="/progress">Progreso</a></div>
      {#if perWeek.some((w) => w.value > 0)}
        <ColumnChart values={perWeek.map((w) => w.value)} labels={perWeek.map((w) => w.label)} label="Entrenos por semana, últimas 8 semanas" />
      {:else}
        <p class="muted empty-chart">Termina tu primer entrenamiento y aquí verás cuántos haces cada semana.</p>
      {/if}
    </section>
  {/if}

  {#if recent.length}
    <section class="block">
      <div class="block-head"><h2>Últimos entrenamientos</h2><a href="/history">Ver todo</a></div>
      <ul class="recent">
        {#each recent as item (item.id)}<li><WorkoutHistoryRow {item} /></li>{/each}
      </ul>
    </section>
  {/if}
</main>

<AppNav />

<style>
  .top {
    margin: 0.5rem 0 1rem;
  }
  .date {
    margin: 0;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .top h1 {
    margin: 0.15rem 0 0.4rem;
  }
  .program {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
    text-decoration: none;
  }
  .today {
    display: grid;
    gap: 0.35rem;
    margin: 0.5rem 0 1rem;
    padding: 1rem;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .label.ok {
    color: var(--ok);
  }
  .today strong {
    font-size: var(--t-lg);
    font-weight: 650;
  }
  .today .muted,
  .meta {
    font-size: var(--t-sm);
  }
  .meta {
    font-weight: 500;
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.25rem;
    font-size: var(--t-sm);
  }
  .go {
    width: auto;
    margin: 0;
    padding: 0 1.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .rows {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.1rem;
  }
  .block {
    margin-top: 1.5rem;
  }
  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .block-head h2 {
    margin: 0;
  }
  .block-head a,
  .block-head .muted {
    font-size: var(--t-sm);
  }
  .block-head a {
    font-weight: 600;
    text-decoration: none;
  }
  .bars {
    display: flex;
    gap: 0.35rem;
  }
  .bars span {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--raised);
  }
  .bars span.on {
    background: var(--accent);
  }
  .empty-chart {
    margin: 0;
    font-size: var(--t-sm);
  }
  .recent {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
</style>
