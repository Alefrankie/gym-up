<script lang="ts">
  import { onMount } from 'svelte';
  import {
    calendarResponseSchema,
    exerciseHistoryResponseSchema,
    exerciseListResponseSchema,
    streakSchema,
    type CalendarDayDto,
    type ChartPointDto,
    type DateRange,
    type ExerciseDto,
    type StreakDto,
  } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import ProgressChart from '#lib/components/ProgressChart.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  const KG_TO_LBS = 2.20462;
  const RANGES: Array<{ value: DateRange; label: string }> = [
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
    { value: 'all', label: 'Todo' },
  ];

  let streak = $state<StreakDto | null>(null);
  let calendar = $state<CalendarDayDto[]>([]);
  let exercises = $state<ExerciseDto[]>([]);
  let exerciseId = $state('');
  let range = $state<DateRange>('30d');
  let metric = $state<'weight' | 'volume'>('weight');
  let points = $state<ChartPointDto[]>([]);
  let error = $state<string | null>(null);
  let stale = $state(false);

  const unit = $derived(session.user?.weightUnit ?? 'kg');
  const convert = (kg: number) => (unit === 'lbs' ? Math.round(kg * KG_TO_LBS * 10) / 10 : Math.round(kg * 10) / 10);
  const labels = $derived(points.map((p) => p.date.slice(5)));
  const values = $derived(points.map((p) => convert(metric === 'weight' ? p.weight : p.volume)));

  function fail(e: unknown, fallback: string) {
    error =
      e instanceof NetworkError
        ? 'Sin conexión y todavía no hay datos guardados.'
        : e instanceof ApiRequestError
          ? e.message
          : fallback;
  }

  async function loadHistory() {
    if (!exerciseId) {
      points = [];
      return;
    }
    try {
      const res = await cachedGet(`/progress/exercises/${exerciseId}/history?range=${range}`, exerciseHistoryResponseSchema);
      points = res.data;
      stale ||= res.stale;
    } catch (e) {
      fail(e, 'No se pudo cargar el historial del ejercicio');
    }
  }

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const [s, c, x] = await Promise.all([
        cachedGet('/progress/streak', streakSchema),
        cachedGet('/progress/calendar', calendarResponseSchema),
        cachedGet('/progress/exercises', exerciseListResponseSchema),
      ]);
      streak = s.data;
      calendar = c.data;
      exercises = x.data;
      stale = s.stale || c.stale || x.stale;
      exerciseId = exercises[0]?.id ?? '';
      await loadHistory();
    } catch (e) {
      fail(e, 'No se pudo cargar tu progreso');
    }
  });
</script>

<main>
  <h1>Progreso</h1>
  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando los últimos datos descargados.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if streak}
    <section class="card stats">
      <div><strong>{streak.current}</strong><span class="muted">días seguidos</span></div>
      <div><strong>{streak.total}</strong><span class="muted">entrenamientos</span></div>
    </section>

    <section class="card">
      <h2>Últimos 28 días</h2>
      <div class="calendar" aria-label="Calendario de entrenamientos">
        {#each calendar as day (day.date)}
          <span class="day" class:on={day.hasWorkout} title={day.date}></span>
        {/each}
      </div>
    </section>

    <section class="card">
      <h2>Evolución por ejercicio</h2>
      {#if exercises.length === 0}
        <p class="muted">Registra tu primer entrenamiento para ver tu evolución.</p>
      {:else}
        <label>
          Ejercicio
          <select bind:value={exerciseId} onchange={loadHistory}>
            {#each exercises as ex (ex.id)}
              <option value={ex.id}>{ex.name}</option>
            {/each}
          </select>
        </label>
        <div class="tabs" role="group" aria-label="Rango">
          {#each RANGES as r (r.value)}
            <button type="button" class:active={range === r.value} onclick={() => { range = r.value; loadHistory(); }}>{r.label}</button>
          {/each}
        </div>
        <div class="tabs" role="group" aria-label="Métrica">
          <button type="button" class:active={metric === 'weight'} onclick={() => (metric = 'weight')}>Peso máximo</button>
          <button type="button" class:active={metric === 'volume'} onclick={() => (metric = 'volume')}>Volumen</button>
        </div>
        {#if points.length === 0}
          <p class="muted">Sin datos en este rango.</p>
        {:else}
          <ProgressChart {labels} {values} label={metric === 'weight' ? `Peso máximo (${unit})` : `Volumen (${unit})`} />
        {/if}
      {/if}
    </section>
  {:else if !error}
    <p class="muted">Cargando…</p>
  {/if}
</main>

<AppNav />

<style>
  .stats {
    display: flex;
    justify-content: space-around;
    text-align: center;
  }
  .stats div {
    display: grid;
  }
  .stats strong {
    font-size: 1.75rem;
    color: var(--accent);
  }
  .calendar {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.35rem;
    margin-top: 0.75rem;
  }
  .day {
    aspect-ratio: 1;
    border-radius: 0.35rem;
    background: #0f172a;
  }
  .day.on {
    background: var(--accent);
  }
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  .tabs button {
    flex: 1;
    padding: 0.5rem;
  }
  .tabs button.active {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
