<script lang="ts">
  import FinishSheet from '#lib/components/FinishSheet.svelte';
  import { page } from '$app/state';
  import { muscleLoad } from '#lib/muscle-load';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { estimateKcal, formatDuration, restStats, sessionSummary } from '#lib/workout-math';
  import { nudge } from '#lib/nudge.svelte';
  import SessionStats from '#lib/components/SessionStats.svelte';
  import { libraryExerciseListResponseSchema, type LibraryExerciseDto, type RoutineExerciseDto } from '@gym-up/contracts';
  import { cachedGet } from '#lib/offline/cache';
  import ExercisePicker from '#lib/components/ExercisePicker.svelte';
  import SortableRows from '#lib/components/SortableRows.svelte';
  import { localDay, relativeDay } from '#lib/dates';
  import { dateLocale, t } from '#lib/i18n';
  import ExerciseRow from '#lib/components/ExerciseRow.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import OverflowMenu from '#lib/components/OverflowMenu.svelte';
  import SaveBar from '#lib/components/SaveBar.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';

  const view = useWorkoutView();
  let finishing = $state(false);
  const completedRows = $derived(Object.values(view.snap?.rows ?? {}).filter((r) => r.completed));
  const id = $derived(page.params.id ?? '');
  const exercises = $derived(view.snap?.exercises ?? []);
  const done = $derived(exercises.reduce((n, e) => n + view.progress(e).done, 0));
  const total = $derived(exercises.reduce((n, e) => n + view.progress(e).total, 0));

  // Changing the exercises here changes this session only; the routine stays as it is.
  let library = $state<LibraryExerciseDto[]>([]);
  let picker = $state<{ mode: 'add' } | { mode: 'replace'; target: RoutineExerciseDto } | null>(null);

  async function openPicker(p: NonNullable<typeof picker>) {
    picker = p;
    if (!library.length) {
      library = (await cachedGet('/exercises', libraryExerciseListResponseSchema, { onCached: (c) => (library = c.data.items) }).catch(() => null))?.data.items ?? library;
    }
  }

  async function pick(ex: LibraryExerciseDto) {
    const p = picker;
    picker = null;
    if (!p) return;
    if (p.mode === 'add') await view.addExercise(ex);
    else await view.replaceExercise(p.target.exerciseId, ex);
  }

  async function removeExercise(ex: RoutineExerciseDto) {
    if (view.progress(ex).done > 0 && !confirm(t('workout.removeDoneConfirm', { name: ex.exerciseName }))) return;
    await view.removeExercise(ex.exerciseId);
  }

  // "29 oct 2026, 20:30 – 21:20"
  const range = $derived.by(() => {
    const snap = view.snap;
    if (!snap) return null;
    const start = new Date(snap.startedAt);
    const day = start.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
    if (snap.day || !snap.endedAt) return day;
    const hm = (d: Date) => d.toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' });
    return `${day}, ${hm(start)} – ${hm(new Date(snap.endedAt))}`;
  });

  async function share() {
    const secs = view.finishedSeconds ?? 0;
    const text = t('summary.shareText', {
      name: view.snap?.dayName ?? '',
      time: formatDuration(secs),
      volume: Math.round(completedRows.filter((r) => r.type !== 'warmup').reduce((n, r) => n + r.reps * r.weight, 0)).toLocaleString(),
      unit: view.unit,
      sets: completedRows.length,
      kcal: estimateKcal(secs),
    });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        nudge.show(t('summary.copied'));
      }
    } catch {
      /* closed the share sheet */
    }
  }

  async function cancel() {
    if (!confirm(t('workout.cancelConfirm'))) return;
    await view.cancel();
  }
</script>

<header class="bar">
  <a class="round" href="/dashboard" aria-label={t('workout.backHome')}><Icon name="left" size={20} /></a>
  {#if view.isCompleted}
    <OverflowMenu items={[{ label: t('workout.edit'), icon: 'edit', onselect: () => view.reopen() }, { label: t('summary.share'), icon: 'copy', onselect: share }]} />
  {:else if !view.snap?.editing}
    <OverflowMenu items={[{ label: t('workout.cancel'), icon: 'trash', danger: true, disabled: view.cancelling || view.finishing, onselect: cancel }]} />
  {/if}
</header>

{#if view.isCompleted}
  <section class="hero">
    <h1>{view.snap?.dayName ?? t('workout.title')}</h1>
    {#if view.finishedSeconds}<p class="clock">{formatDuration(view.finishedSeconds)}</p>{/if}
    {#if range}<p class="muted when">{range}</p>{/if}
  </section>
  <h2>{t('summary.details')}</h2>
  <SessionStats
    sets={completedRows.length}
    volume={Math.round(completedRows.filter((r) => r.type !== 'warmup').reduce((n, r) => n + r.reps * r.weight, 0))}
    unit={view.unit}
    kcal={view.finishedSeconds ? estimateKcal(view.finishedSeconds) : null}
    records={view.records}
    rest={restStats(completedRows.map((r) => r.doneAt))}
  />
{:else}
<section class="head">
  <div class="status">
    {#if view.isCompleted}
      <span class="done-label"><Icon name="check" size={14} /> {t('workout.completed')}</span>
    {:else}
      <span class="live"><span class="dot"></span>{t('workout.inProgress')}</span>
    {/if}
    {#if view.snap?.day}<span class="time"><Icon name="history" size={14} />{relativeDay(view.snap.day, localDay())}</span>{/if}
    {#if view.elapsed}<span class="time" role="timer" aria-label={t('workout.elapsed')}><Icon name="timer" size={14} />{view.elapsed}</span>{/if}
  </div>
  <h1>{view.snap?.dayName ?? t('workout.title')}</h1>
  {#if exercises.length}<p class="meta">{sessionSummary(exercises)}</p>{/if}
  <div class="progress" aria-label={t('workout.setsDone', { done, total })}><span style:width={`${total ? (done / total) * 100 : 0}%`}></span></div>
  <span class="muted count">{t('workout.setsDone', { done, total })}</span>
</section>


<TargetMuscles muscles={muscleLoad(exercises)} />
{/if}

<div class="head-row">
  <h2>{t('workout.exercises')}</h2>
  {#if !view.isCompleted}
    <button type="button" class="icon add" aria-label={t('workout.addExercise')} onclick={() => openPicker({ mode: 'add' })}><Icon name="plus" size={18} /></button>
  {/if}
</div>
<SortableRows
  items={view.isCompleted ? exercises.filter((e) => view.doneSets(e).length) : exercises}
  key={(ex) => ex.exerciseId}
  disabled={view.isCompleted}
  onreorder={(next) => view.reorder(next)}
  onremove={view.isCompleted ? undefined : removeExercise}
  onreplace={view.isCompleted ? undefined : (ex) => openPicker({ mode: 'replace', target: ex })}
>
  {#snippet row(ex)}
    <ExerciseRow {ex} unit={view.unit} href={`/workout/${id}/${ex.exerciseId}`} progress={view.isCompleted ? undefined : view.progress(ex)} sets={view.doneSets(ex)} lines={view.isCompleted} />
  {/snippet}
</SortableRows>
{#if !view.isCompleted}
  <p class="muted note">{t('workout.onlyThisSession')}</p>
{:else}
  <div class="spacer"></div>
{/if}

{#if picker}
  <ExercisePicker
    exercises={library}
    title={picker.mode === 'replace' ? t('routine.replace', { name: picker.target.exerciseName }) : t('workout.addExercise')}
    onpick={pick}
    onclose={() => (picker = null)}
  />
{/if}

{#if view.isCompleted}
  <div class="share-bar"><button type="button" class="primary" onclick={share}><Icon name="copy" size={18} /> {t('summary.share')}</button></div>
{:else}
  <SaveBar dirty={false} saved={false} onsave={() => {}}>
    {#snippet idle()}
      <button class="primary" disabled={view.finishing || !view.anyCompleted} onclick={() => (finishing = true)}>
        <Icon name="check" size={18} /> {view.finishing ? t('workout.finishing') : view.snap?.editing ? t('finish.save') : t('workout.finish')}
      </button>
    {/snippet}
  </SaveBar>
{/if}

{#if finishing}<FinishSheet {view} onclose={() => (finishing = false)} />{/if}

<style>
  .hero {
    display: grid;
    gap: 0.15rem;
    margin: 0.5rem 0 1.25rem;
  }
  .hero h1 {
    font-size: 2.1rem;
    line-height: 1.1;
  }
  .clock {
    margin: 0;
    font-family: var(--font-display);
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1;
    color: var(--accent-hi);
    font-variant-numeric: tabular-nums;
  }
  .when {
    margin: 0.2rem 0 0;
    font-size: var(--t-sm);
  }
  .spacer {
    height: 6rem;
  }
  .share-bar {
    position: fixed;
    left: 1rem;
    right: 1rem;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 20;
    max-width: 32rem;
    margin: 0 auto;
  }
  .share-bar .primary {
    width: 100%;
    min-height: 56px;
    border-radius: 999px;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0.25rem 0 0.5rem;
  }
  .round {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
  }
  .head {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--accent-hi);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
  .done-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--ok);
  }
  .time {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-variant-numeric: tabular-nums;
  }
  h1 {
    margin: 0;
  }
  .meta {
    margin: 0;
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .progress {
    height: 4px;
    margin-top: 0.4rem;
    border-radius: 2px;
    background: var(--raised);
    overflow: hidden;
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 300ms var(--ease);
  }
  .count {
    font-size: var(--t-xs);
  }
  .head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .add {
    width: 40px;
    min-height: 40px;
    border-radius: 50%;
    color: var(--accent-hi);
  }
  .note {
    margin: 0.75rem 0 6rem;
    font-size: var(--t-xs);
    text-align: center;
  }
</style>
