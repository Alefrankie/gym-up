<script lang="ts">
  import { t } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { exerciseHistoryResponseSchema, libraryExerciseDtoSchema, type ChartPointDto, type LibraryExerciseDto } from '@gym-up/contracts';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import ProgressChart from '#lib/components/ProgressChart.svelte';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { TYPE_LABELS, equipment, muscle } from '#lib/labels';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';

  const id = $derived(page.params.id ?? '');
  let exercise = $state<LibraryExerciseDto | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      exercise = (await cachedGet(`/exercises/${id}`, libraryExerciseDtoSchema, { onCached: (c) => (exercise = c.data) })).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('exercise.offlineNotSaved')
          : e instanceof ApiRequestError && e.status === 404
            ? t('exercise.notFound')
            : t('exercise.loadError');
    }
  });

  // Your heaviest set per session with this exercise, when there is any.
  let history = $state<ChartPointDto[]>([]);
  const unit = $derived(session.user?.weightUnit ?? 'kg');
  $effect(() => {
    if (!id) return;
    cachedGet(`/progress/exercises/${id}/history?range=all`, exerciseHistoryResponseSchema, { onCached: (c) => (history = c.data) })
      .then((r) => (history = r.data))
      .catch(() => {});
  });

  const mine = $derived(exercise?.isCustom && exercise.ownerId === session.user?.id);
  const steps = $derived(
    (exercise?.instructions ?? '')
      .split('\n')
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean),
  );

  async function archive() {
    if (!confirm(t('exercise.archiveConfirm'))) return;
    busy = true;
    try {
      await api(`/exercises/${id}`, { method: 'DELETE' });
      await invalidateCache(['/exercises']);
      await goto('/library');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : t('programs.archiveError');
      busy = false;
    }
  }
</script>

<main>
  <p><a class="back" href="/library"><Icon name="left" size={16} /> {t('library.title')}</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if exercise}
    <h1>{exercise.name}</h1>
    {#if exercise.isArchived}<p class="muted">{t('exercise.archived')}</p>{/if}

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
        <dt>{t('library.equipment')}</dt>
        <dd>{equipment(exercise.equipment)}</dd>
        <dt>{t('exercise.tracking')}</dt>
        <dd>{TYPE_LABELS[exercise.exerciseType] ?? exercise.exerciseType}</dd>
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
        {#each steps as s, i}
          <li><span class="n">{i + 1}</span><span>{s}</span></li>
        {/each}
      </ol>
    {/if}

    {#if exercise.videoUrl}
      <p><a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">{t('exercise.watchVideo')}</a></p>
    {/if}

    {#if mine && !exercise.isArchived}
      <div class="actions">
        <a class="edit" href={`/library/${id}/edit`}><Icon name="edit" size={16} /> {t('common.edit')}</a>
        <button class="danger" disabled={busy} onclick={archive}><Icon name="trash" size={16} /> {t('exercise.archive')}</button>
      </div>
    {/if}
  {:else if !error}
    <p class="muted loading">{t('common.loading')}</p>
  {/if}
</main>

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
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }
  .actions > * {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-size: var(--t-sm);
  }
  .edit {
    min-height: var(--control);
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--text);
    font-weight: 550;
    text-decoration: none;
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
