<script lang="ts">
  import { page } from '$app/state';
  import { muscleLoad } from '#lib/muscle-load';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { sessionSummary } from '#lib/workout-math';
  import { t } from '#lib/i18n';
  import ExerciseRow from '#lib/components/ExerciseRow.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import OverflowMenu from '#lib/components/OverflowMenu.svelte';
  import SaveBar from '#lib/components/SaveBar.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';

  const view = useWorkoutView();
  const id = $derived(page.params.id ?? '');
  const exercises = $derived(view.snap?.exercises ?? []);
  const done = $derived(exercises.reduce((n, e) => n + view.progress(e).done, 0));
  const total = $derived(exercises.reduce((n, e) => n + view.progress(e).total, 0));

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
    {#if view.elapsed}<span class="time" role="timer" aria-label={t('workout.elapsed')}><Icon name="timer" size={14} />{view.elapsed}</span>{/if}
  </div>
  <h1>{view.snap?.dayName ?? t('workout.title')}</h1>
  {#if exercises.length}<p class="meta">{sessionSummary(exercises)}</p>{/if}
  <div class="progress" aria-label={t('workout.setsDone', { done, total })}><span style:width={`${total ? (done / total) * 100 : 0}%`}></span></div>
  <span class="muted count">{t('workout.setsDone', { done, total })}</span>
</section>

<TargetMuscles muscles={muscleLoad(exercises)} />

<h2>{t('workout.exercises')}</h2>
<ul class="rows">
  {#each exercises as ex (ex.exerciseId)}
    <li><ExerciseRow {ex} unit={view.unit} href={`/workout/${id}/${ex.exerciseId}`} progress={view.progress(ex)} sets={view.doneSets(ex)} /></li>
  {/each}
</ul>

{#if !view.isCompleted}
  <SaveBar dirty={false} saved={false} onsave={() => {}}>
    {#snippet idle()}
      <button class="primary" disabled={view.finishing || !view.anyCompleted} onclick={() => view.finish()}>
        <Icon name="check" size={18} /> {view.finishing ? t('workout.finishing') : t('workout.finish')}
      </button>
    {/snippet}
  </SaveBar>
{/if}

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
  .rows {
    list-style: none;
    margin: 0 0 6rem;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
</style>
