<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    calendarResponseSchema,
    programDetailDtoSchema,
    programListResponseSchema,
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
  import WeekDays from '#lib/components/WeekDays.svelte';
  import LogDaySheet from '#lib/components/LogDaySheet.svelte';
  import WorkoutHistoryRow from '#lib/components/WorkoutHistoryRow.svelte';
  import { randomQuote } from '#lib/quotes';
  import { localDay } from '#lib/dates';
  import { routineForDate } from '#lib/weekday-routine';
  import { dateLocale, t, tn } from '#lib/i18n';

  let today = $state<TodayWorkoutResponse | null>(null);
  // The day picked on the week strip to log a workout for.
  let logDay = $state<string | null>(null);
  let stale = $state(false);
  let live = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let showExercises = $state(false);
  let calendar = $state<CalendarDayDto[]>([]);
  let recent = $state<WorkoutHistoryItemDto[]>([]);

  const quote = randomQuote();
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
      void followWeekday();
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('home.noDataOffline')
          : e instanceof ApiRequestError
            ? e.message
            : t('home.loadError');
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

  // Weekday programs: Home shows the routine named after today, not the next one in the rotation.
  let planned = $state<TodayWorkoutResponse | null>(null);
  // The routine coming up after today's (shown on rest days and once today's is done).
  let nextUp = $state<{ name: string; weekday: number } | null>(null);
  let restDay = $state(false);
  let byWeekday = $state(false);

  async function followWeekday() {
    try {
      const list = (await cachedGet('/programs', programListResponseSchema)).data;
      if (!list.activeProgramId) return;
      const program = (await cachedGet(`/programs/${list.activeProgramId}`, programDetailDtoSchema)).data;
      const pick = routineForDate(program.routines, new Date());
      if (!pick) return;
      byWeekday = true;
      nextUp = pick.next && pick.nextWeekday !== null ? { name: pick.next.name, weekday: pick.nextWeekday } : null;
      if (!pick.today) {
        restDay = true;
        return;
      }
      if (today?.kind === 'workout_day' && today.routineDay.id === pick.today.id) return;
      planned = (await cachedGet(`/workouts/routine/${pick.today.id}`, todayWorkoutResponseSchema, { onCached: (c) => (planned = c.data) })).data;
    } catch {
      /* offline with nothing saved: keep the rotation's suggestion */
    }
  }

  const weekdayName = (d: number) => {
    const ref = new Date(2024, 0, 7 + d); // 7 Jan 2024 was a Sunday
    return ref.toLocaleDateString(dateLocale(), { weekday: 'long' });
  };

  /** Starts (or resumes) today's workout and opens the chosen exercise, or the first one. */
  async function start(w: Extract<TodayWorkoutResponse, { kind: 'workout_day' }>, exerciseId?: string) {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const id = await beginWorkout(w);
      const first = exerciseId ?? w.exercises[0]?.exerciseId;
      await goto(first ? `/workout/${id}/${first}` : `/workout/${id}`);
    } catch {
      error = t('home.startError');
      busy = false;
    }
  }
</script>

<main>
  <header class="top">
    <p class="date">{dateLabel}</p>
    <h1>{session.user ? t('home.helloName', { name: session.user.displayName.split(' ')[0]! }) : t('home.hello')}</h1>
    <p class="quote">“{quote}”</p>
    {#if today?.kind === 'workout_day' && today.programName}
      <a class="program" href="/programs"><Icon name="dumbbell" size={14} />{today.programName}</a>
    {/if}
  </header>

  <SyncBanner />
  {#if stale}<p class="muted">{t('common.offline')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <ActiveWorkoutCard oncancelled={() => location.reload()} />

  {#if !live}
    {#if byWeekday && restDay}
      <!-- A planned rest day never blocks training: plans change, the gym is still open. -->
      <section class="today">
        <span class="label">{t('common.today')}</span>
        <strong>{t('home.restDay')}</strong>
        {#if nextUp}<span class="muted">{t('home.nextOn', { name: nextUp.name, day: weekdayName(nextUp.weekday) })}</span>{/if}
        <div class="actions">
          <span></span>
          <button type="button" class="go secondary" onclick={() => (logDay = localDay())}><Icon name="bolt" size={16} /> {t('home.trainAnyway')}</button>
        </div>
      </section>
    {:else if (planned ?? today)?.kind === 'workout_day'}
      {@const w = (planned ?? today) as Extract<TodayWorkoutResponse, { kind: 'workout_day' }>}
      {#if w.workoutStatus === 'completed'}
        <a class="today done" href={w.existingWorkoutId ? `/workout/${w.existingWorkoutId}` : '/history'}>
          <span class="label ok"><Icon name="check" size={14} /> {t('home.doneToday')}</span>
          <strong>{w.routineDay.dayName}</strong>
          <span class="muted">{t('home.seeSummary')}</span>
          {#if byWeekday && nextUp}<span class="muted">{t('home.doneNext', { name: nextUp.name, day: weekdayName(nextUp.weekday) })}</span>{/if}
        </a>
      {:else}
        <section class="today">
          <span class="label">{#if byWeekday}{t('home.todayRoutine')}{:else}{t('home.todayIs')}{#if w.week?.target}{' · '}{t('home.dayOf', { n: w.dayNumber, total: w.week.target })}{/if}{/if}</span>
          <strong>{w.routineDay.dayName}</strong>
          <span class="meta">{w.routineDay.focus ? `${w.routineDay.focus} · ` : ''}{sessionSummary(w.exercises)}</span>
          <TargetMuscles muscles={muscleLoad(w.exercises)} compact />
          <div class="actions">
            <button type="button" class="ghost toggle" aria-expanded={showExercises} onclick={() => (showExercises = !showExercises)}>
              {showExercises ? t('home.hideExercises') : t('home.showExercises')} <Icon name={showExercises ? 'up' : 'down'} size={16} />
            </button>
            <button class="primary go" disabled={busy} onclick={() => start(w)}><Icon name="bolt" size={16} /> {t('home.start')}</button>
          </div>
          {#if showExercises}
            <ul class="rows" transition:slide={{ duration: 240, easing: cubicOut }}>
              {#each w.exercises as ex (ex.id)}
                <li><ExerciseRow {ex} unit={w.weightUnit} onclick={() => start(w, ex.exerciseId)} /></li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    {:else if today?.kind === 'no_routine'}
      <a class="today" href="/programs">
        <span class="label">{t('home.startHere')}</span>
        <strong>{t('home.pickProgram')}</strong>
        <span class="muted">{t('home.pickProgramHint')}</span>
      </a>
    {:else if today?.kind === 'rest_day'}
      <section class="today">
        <span class="label">{t('common.today')}</span>
        <strong>{t('home.restDay')}</strong>
      </section>
    {/if}
  {/if}

  <SupplementsCard />

  <section class="block">
    <div class="block-head">
      <h2>{t('home.thisWeek')}</h2>
      {#if today?.kind === 'workout_day' && today.week && today.week.target > 0}
        <span class="muted">{t('home.weekProgress', { done: Math.min(today.week.done, today.week.target), target: today.week.target })}</span>
      {/if}
    </div>
    <WeekDays trained={calendar.filter((d) => d.hasWorkout).map((d) => d.date)} today={localDay()} onpick={(d) => (logDay = d)} />
    <p class="muted tap-hint">{t('logDay.tap')}</p>
  </section>

  {#if calendar.length}
    <section class="block card">
      <div class="block-head"><h2>{t('home.perWeek')}</h2><a href="/progress">{t('nav.progress')}</a></div>
      <ColumnChart values={perWeek.map((w) => w.value)} labels={perWeek.map((w) => w.label)} label={t('home.perWeekLabel')} empty={t('home.perWeekEmpty')} />
    </section>
  {/if}

  {#if recent.length}
    <section class="block">
      <div class="block-head"><h2>{t('home.recent')}</h2><a href="/history">{t('common.seeAll')}</a></div>
      <ul class="recent">
        {#each recent as item (item.id)}<li><WorkoutHistoryRow {item} /></li>{/each}
      </ul>
    </section>
  {/if}
</main>

{#if logDay}
  <LogDaySheet day={logDay} onclose={() => (logDay = null)} />
{/if}

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
  .quote {
    margin: 0 0 0.75rem;
    color: var(--muted);
    font-size: var(--t-sm);
    font-style: italic;
    line-height: 1.4;
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
    /* One column no wider than the card: the muscle carousel inside must scroll, not stretch the card. */
    grid-template-columns: minmax(0, 1fr);
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
  .secondary {
    min-height: 44px;
    border-radius: 999px;
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
  .tap-hint {
    margin: 0.5rem 0 0;
    font-size: var(--t-xs);
    text-align: center;
  }
  .recent {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
</style>
