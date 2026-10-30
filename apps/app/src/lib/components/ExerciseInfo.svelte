<script lang="ts">
  import { exerciseHistoryResponseSchema, type ChartPointDto } from '@gym-up/contracts';
  import { t } from '#lib/i18n';
  import { TYPE_LABELS, equipment, muscle } from '#lib/labels';
  import { cachedGet } from '#lib/offline/cache';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import { session } from '#lib/session';
  import MuscleFigure from './MuscleFigure.svelte';
  import ProgressChart from './ProgressChart.svelte';

  /**
   * Everything about one exercise: muscles, equipment, your progress with it, how to do it and its video.
   * Shared by the library page and the routine editor's exercise view.
   */
  let {
    exercise,
  }: {
    exercise: {
      id: string;
      primaryMuscle: string;
      secondaryMuscles: string[];
      equipment?: string;
      exerciseType?: string;
      instructions?: string | null;
      videoUrl?: string | null;
    };
  } = $props();

  // Your heaviest set per session with this exercise, when there is any.
  let history = $state<ChartPointDto[]>([]);
  const unit = $derived(session.user?.weightUnit ?? 'kg');
  $effect(() => {
    const id = exercise.id;
    history = [];
    cachedGet(`/progress/exercises/${id}/history?range=all`, exerciseHistoryResponseSchema, { onCached: (c) => (history = c.data) })
      .then((r) => (history = r.data))
      .catch(() => {});
  });

  const steps = $derived(
    (exercise.instructions ?? '')
      .split('\n')
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean),
  );
</script>

<section class="card hero figure">
  <MuscleFigure
    primary={exercise.primaryMuscle}
    secondary={exercise.secondaryMuscles}
    view="both"
    size={84}
    label={t('exercise.musclesWorked', { muscle: muscle(exercise.primaryMuscle) })}
  />
  <dl>
    <dt>{t('exercise.primary')}</dt>
    <dd class="main">{muscle(exercise.primaryMuscle)}</dd>
    {#if exercise.secondaryMuscles.length}
      <dt>{t('exercise.secondary')}</dt>
      <dd>{exercise.secondaryMuscles.map(muscle).join(', ')}</dd>
    {/if}
    {#if exercise.equipment}
      <dt>{t('library.equipment')}</dt>
      <dd>{equipment(exercise.equipment)}</dd>
    {/if}
    {#if exercise.exerciseType}
      <dt>{t('exercise.tracking')}</dt>
      <dd>{TYPE_LABELS[exercise.exerciseType] ?? exercise.exerciseType}</dd>
    {/if}
  </dl>
</section>

{#if history.length}
  <section class="card progress">
    <h2 class="first">{t('exercise.progress')}</h2>
    <p class="muted sub">{t('exercise.progressSub', { unit, record: Math.max(...history.map((p) => toDisplay(p.weight, unit))) })}</p>
    <ProgressChart labels={history.map((p) => p.date.slice(5))} values={history.map((p) => toDisplay(p.weight, unit))} label={t('exercise.maxWeight', { unit })} />
  </section>
{/if}

{#if steps.length}
  <h2>{t('exercise.howTo')}</h2>
  <ol class="steps">
    {#each steps as s, i (i)}
      <li><span class="n">{i + 1}</span><span>{s}</span></li>
    {/each}
  </ol>
{/if}

{#if exercise.videoUrl}
  <p><a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">{t('exercise.watchVideo')}</a></p>
{/if}

<style>
  .figure {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 0.05rem;
    min-width: 0;
  }
  dt {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 500;
    margin-top: 0.4rem;
  }
  dt:first-child {
    margin-top: 0;
  }
  dd {
    margin: 0;
    font-size: var(--t-base);
    font-weight: 500;
  }
  dd.main {
    color: var(--accent-hi);
    font-size: var(--t-lg);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .steps {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .steps li {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    padding: 0.65rem 0.8rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    line-height: 1.5;
  }
  .n {
    flex: none;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-top: 0.05rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-size: var(--t-xs);
    font-weight: 600;
  }
  .progress {
    margin-top: 1rem;
  }
  .progress .first {
    margin: 0;
  }
  .progress .sub {
    margin: 0.2rem 0 0.75rem;
    font-size: var(--t-sm);
  }
</style>
