<script lang="ts">
  import { t, tn, dateLocale, type MessageKey } from '#lib/i18n';
  import Select from '#lib/components/Select.svelte';
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
  import ColumnChart from '#lib/components/ColumnChart.svelte';
  import LogDaySheet from '#lib/components/LogDaySheet.svelte';
  import ProgressChart from '#lib/components/ProgressChart.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import Icon from '#lib/components/Icon.svelte';

  const KG_TO_LBS = 2.20462;
  const RANGES: Array<{ value: DateRange; label: MessageKey }> = [
    { value: '7d', label: 'progress.range7' },
    { value: '30d', label: 'progress.range30' },
    { value: 'all', label: 'progress.rangeAll' },
  ];

  let streak = $state<StreakDto | null>(null);
  let calendar = $state<CalendarDayDto[]>([]);
  // Tapping a past day (up to 60 days back) logs a workout on it.
  let logDay = $state<string | null>(null);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

  const monthName = (m: number, month: 'short' | 'long') => new Date(2000, m, 1).toLocaleDateString(dateLocale(), { month });
  const DAYS = $derived(t('progress.dayLabels').split(','));
  const now = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const monthKey = ymd(now).slice(0, 7);
  const yearKey = ymd(now).slice(0, 4);

  const done = $derived(new Set(calendar.filter((d) => d.hasWorkout).map((d) => d.date)));
  const thisMonth = $derived([...done].filter((d) => d.startsWith(monthKey)).length);
  const thisYear = $derived([...done].filter((d) => d.startsWith(yearKey)).length);
  const thisWeek = $derived.by(() => {
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const from = ymd(monday);
    return [...done].filter((d) => d >= from).length;
  });

  /** Columns of 7 days (Monday first), oldest week first, ending with the current week. */
  const weeks = $derived.by(() => {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + (6 - ((end.getUTCDay() + 6) % 7)));
    const cols: { date: string; on: boolean; future: boolean }[][] = [];
    for (let w = 52; w >= 0; w--) {
      const col = [];
      for (let d = 6; d >= 0; d--) {
        const day = new Date(end);
        day.setUTCDate(end.getUTCDate() - w * 7 - d);
        const key = ymd(day);
        col.push({ date: key, on: done.has(key), future: key > ymd(now) });
      }
      cols.push(col);
    }
    return cols;
  });

  /** Month label over the first week column that starts in that month. */
  const monthLabel = (col: { date: string }[], i: number) => {
    const m = Number(col[0]!.date.slice(5, 7)) - 1;
    const prev = i > 0 ? Number(weeks[i - 1]![0]!.date.slice(5, 7)) - 1 : -1;
    return m !== prev ? monthName(m, 'short').replace('.', '') : '';
  };

  let heat = $state<HTMLElement>();
  // Open on the current weeks, like a calendar scrolled to today.
  $effect(() => {
    if (heat && weeks.length) heat.scrollLeft = heat.scrollWidth;
  });
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
        ? t('progress.offlineEmpty')
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
      fail(e, t('progress.historyError'));
    }
  }

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const [s, c, x] = await Promise.all([
        cachedGet('/progress/streak', streakSchema, { onCached: (c) => (streak = c.data) }),
        cachedGet('/progress/calendar?days=371', calendarResponseSchema, { onCached: (c) => (calendar = c.data) }),
        cachedGet('/progress/exercises', exerciseListResponseSchema, { onCached: (c) => ((exercises = c.data), (exerciseId ||= c.data[0]?.id ?? '')) }),
      ]);
      streak = s.data;
      calendar = c.data;
      exercises = x.data;
      stale = s.stale || c.stale || x.stale;
      exerciseId = exercises[0]?.id ?? '';
      await loadHistory();
    } catch (e) {
      fail(e, t('progress.loadError'));
    }
  });
</script>

<main>
  <h1>{t('nav.progress')}</h1>
  <SyncBanner />
  {#if stale}<p class="muted">{t('progress.stale')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if streak}
    <div class="tiles">
      <a class="tile" href="/history">
        <span class="ico ember"><Icon name="flame" size={20} /></span>
        <strong>{streak.current > 0 ? tn('progress.days', streak.current) : t('progress.noStreak')}</strong>
        <span class="muted">{t('progress.currentStreak')}</span>
      </a>
      <a class="tile" href="/history">
        <span class="ico"><Icon name="bolt" size={20} /></span>
        <strong>{tn('progress.workouts', thisWeek)}</strong>
        <span class="muted">{t('progress.thisWeek')}</span>
      </a>
      <a class="tile month" href="/history">
        <span class="watermark" aria-hidden="true">{now.getDate()}</span>
        <strong>{monthName(now.getMonth(), 'long').replace(/^./, (c) => c.toUpperCase())}</strong>
        <span class="muted">{tn('progress.workouts', thisMonth)}</span>
      </a>
      <a class="tile" href="/history">
        <span class="ico"><Icon name="dumbbell" size={20} /></span>
        <strong>{streak.total}</strong>
        <span class="muted">{t('progress.totalWorkouts')}</span>
      </a>
    </div>

    <section class="card year">
      <div class="year-head">
        <h2 class="first">{tn('progress.workouts', thisYear)}</h2>
        <span class="muted">{yearKey}</span>
      </div>
      <div class="heat-wrap">
        <div class="labels" aria-hidden="true">
          <span></span>
          {#each DAYS as d, i (i)}<span>{d}</span>{/each}
        </div>
        <div class="heat" bind:this={heat} aria-label={t('progress.yearLabel')}>
          {#each weeks as col, i (col[0]!.date)}
            <div class="col">
              <span class="m">{monthLabel(col, i)}</span>
              {#each col as day (day.date)}
                {#if !day.future && day.date >= sixtyDaysAgo}
                  <button type="button" class="cell" class:on={day.on} title={day.date} aria-label={t('logDay.title', { day: day.date })} onclick={() => (logDay = day.date)}></button>
                {:else}
                  <span class="cell" class:on={day.on} class:future={day.future} title={day.date}></span>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      </div>
      <p class="muted tap-hint">{t('logDay.tap')}</p>
    </section>

    <section class="card">
      <h2 class="first">{t('progress.perWeek')}</h2>
      <p class="muted chart-sub">{t('progress.last12Weeks')}</p>
      <ColumnChart
        values={weeks.slice(-12).map((col) => col.filter((d) => d.on).length)}
        labels={weeks.slice(-12).map((col) => String(Number(col[0]!.date.slice(8))))}
        label={t('progress.perWeek')}
      />
    </section>

    <section class="card">
      <h2 class="first">{t('progress.byExercise')}</h2>
      {#if exercises.length === 0}
        <p class="muted">{t('progress.noExercises')}</p>
      {:else}
        <label>
          {t('progress.exercise')}
          <Select bind:value={exerciseId} options={exercises.map((ex) => ({ value: ex.id, label: ex.name }))} onchange={loadHistory} />
        </label>
        <div class="tabs" role="group" aria-label={t('progress.range')}>
          {#each RANGES as r (r.value)}
            <button type="button" class:active={range === r.value} onclick={() => { range = r.value; loadHistory(); }}>{t(r.label)}</button>
          {/each}
        </div>
        <div class="tabs" role="group" aria-label={t('progress.metric')}>
          <button type="button" class:active={metric === 'weight'} onclick={() => (metric = 'weight')}>{t('progress.maxWeight')}</button>
          <button type="button" class:active={metric === 'volume'} onclick={() => (metric = 'volume')}>{t('progress.volume')}</button>
        </div>
        {#if points.length === 0}
          <p class="muted">{t('progress.noData')}</p>
        {:else}
          <ProgressChart {labels} {values} label={metric === 'weight' ? `${t('progress.maxWeight')} (${unit})` : `${t('progress.volume')} (${unit})`} />
        {/if}
      {/if}
    </section>
  {:else if !error}
    <p class="muted loading">{t('common.loading')}</p>
  {/if}
</main>

{#if logDay}
  <LogDaySheet day={logDay} onclose={() => (logDay = null)} />
{/if}

<AppNav />

<style>
  .first {
    margin: 0 0 0.75rem;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .tile {
    position: relative;
    overflow: hidden;
    display: grid;
    align-content: end;
    gap: 0.15rem;
    min-height: 9rem;
    padding: 1rem;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  .tile:active {
    background: var(--surface-hi);
  }
  .tile .ico {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: var(--surface-hi);
    color: var(--text);
  }
  .tile .ico.ember {
    color: var(--ember);
  }
  .tile strong {
    font-size: var(--t-md);
    font-weight: 650;
  }
  .tile .muted {
    font-size: var(--t-sm);
  }
  .watermark {
    position: absolute;
    right: -0.25rem;
    bottom: -1.4rem;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 5.5rem;
    line-height: 1;
    color: var(--surface-hi);
  }
  .month strong,
  .month .muted {
    position: relative;
  }
  .year-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .heat-wrap {
    display: flex;
    gap: 0.4rem;
  }
  .labels,
  .col {
    display: grid;
    grid-template-rows: 16px repeat(7, 18px);
    gap: 4px;
  }
  .labels span {
    font-size: var(--t-xs);
    color: var(--muted);
    line-height: 18px;
  }
  .heat {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .heat::-webkit-scrollbar {
    display: none;
  }
  .m {
    font-size: var(--t-xs);
    color: var(--muted);
    white-space: nowrap;
    width: 18px;
    overflow: visible;
  }
  .cell {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: var(--surface-hi);
  }
  button.cell {
    min-height: 0;
    padding: 0;
    box-shadow: none;
  }
  .cell.on {
    background: var(--accent);
  }
  .cell.future {
    background: transparent;
  }
  /* Segmented control: one track, the active segment lifts one surface step. */
  .tabs {
    display: flex;
    gap: 2px;
    margin: 0.75rem 0;
    padding: 2px;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .tabs button {
    flex: 1;
    min-height: 36px;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    background: none;
    box-shadow: none;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .tabs button.active {
    background: var(--raised);
    color: var(--text);
  }
  .chart-sub {
    margin: 0.2rem 0 1rem;
    font-size: var(--t-sm);
  }
  .tap-hint {
    margin: 0.75rem 0 0;
    font-size: var(--t-xs);
  }
</style>
