<script lang="ts">
  import FinishSheet from '#lib/components/FinishSheet.svelte';
  import { page } from '$app/state';
  import { muscleLoad } from '#lib/muscle-load';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { sessionSummary } from '#lib/workout-math';
  import { libraryExerciseListResponseSchema, type LibraryExerciseDto, type RoutineExerciseDto } from '@gym-up/contracts';
  import { cachedGet } from '#lib/offline/cache';
  import ExercisePicker from '#lib/components/ExercisePicker.svelte';
  import SortableRows from '#lib/components/SortableRows.svelte';
  import { localDay, relativeDay } from '#lib/dates';
  import { t } from '#lib/i18n';
  import ExerciseRow from '#lib/components/ExerciseRow.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import OverflowMenu from '#lib/components/OverflowMenu.svelte';
  import SaveBar from '#lib/components/SaveBar.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';

  const view = useWorkoutView();
  let finishing = $state(false);
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

  async function cancel() {
    if (!confirm(t('workout.cancelConfirm'))) return;
    await view.cancel();
  }
</script>

<header class="bar">
  <a class="round" href="/dashboard" aria-label={t('workout.backHome')}><Icon name="left" size={20} /></a>
  {#if !view.isCompleted}
    <OverflowMenu items={[{ label: t('workout.cancel'), icon: 'trash', danger: true, disabled: view.cancelling || view.finishing, onselect: cancel }]} />
  {/if}
</header>

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

<div class="head-row">
  <h2>{t('workout.exercises')}</h2>
  {#if !view.isCompleted}
    <button type="button" class="icon add" aria-label={t('workout.addExercise')} onclick={() => openPicker({ mode: 'add' })}><Icon name="plus" size={18} /></button>
  {/if}
</div>
<SortableRows
  items={exercises}
  key={(ex) => ex.exerciseId}
  disabled={view.isCompleted}
  onreorder={(next) => view.reorder(next)}
  onremove={view.isCompleted ? undefined : removeExercise}
  onreplace={view.isCompleted ? undefined : (ex) => openPicker({ mode: 'replace', target: ex })}
>
  {#snippet row(ex)}
    <ExerciseRow {ex} unit={view.unit} href={`/workout/${id}/${ex.exerciseId}`} progress={view.progress(ex)} sets={view.doneSets(ex)} />
  {/snippet}
</SortableRows>
{#if !view.isCompleted}
  <p class="muted note">{t('workout.onlyThisSession')}</p>
{/if}

{#if picker}
  <ExercisePicker
    exercises={library}
    title={picker.mode === 'replace' ? t('routine.replace', { name: picker.target.exerciseName }) : t('workout.addExercise')}
    onpick={pick}
    onclose={() => (picker = null)}
  />
{/if}

{#if !view.isCompleted}
  <SaveBar dirty={false} saved={false} onsave={() => {}}>
    {#snippet idle()}
      <button class="primary" disabled={view.finishing || !view.anyCompleted} onclick={() => (finishing = true)}>
        <Icon name="check" size={18} /> {view.finishing ? t('workout.finishing') : t('workout.finish')}
      </button>
    {/snippet}
  </SaveBar>
{/if}

{#if finishing}<FinishSheet {view} onclose={() => (finishing = false)} />{/if}

<style>
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
