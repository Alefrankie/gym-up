<script lang="ts">
  import type { WorkoutHistoryItemDto } from '@gym-up/contracts';
  import { dateLocale, t, tn } from '#lib/i18n';
  import { estimateKcal, formatDuration } from '#lib/workout-math';
  import Icon from './Icon.svelte';
  import SetTypeBadge from './SetTypeBadge.svelte';

  /** One past workout: when, which routine, how many exercises, its volume and any warm-up / drop / failure sets. */
  let { item }: { item: WorkoutHistoryItemDto } = $props();
  const date = $derived(new Date(item.workoutDate).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).replaceAll('.', ''));
</script>

<a class="row" href={`/workout/${item.id}`}>
  <span class="ico"><Icon name="dumbbell" size={18} /></span>
  <span class="grow">
    <strong>{item.routineDayName} {#if item.status === 'in_progress'}<span class="badge">{t('workout.inProgress')}</span>{/if}</strong>
    <span class="muted meta">{date} · {tn('workout.exerciseCount', item.exerciseCount)}</span>
    {#if item.durationSeconds}
      <span class="muted meta">{formatDuration(item.durationSeconds)} · <span class="kcal">≈ {estimateKcal(item.durationSeconds)} kcal</span></span>
    {/if}
    {#if item.warmupSets || item.dropSets || item.failureSets}
      <span class="kinds">
        {#if item.warmupSets}<span class="kind"><SetTypeBadge type="warmup" />{item.warmupSets}</span>{/if}
        {#if item.dropSets}<span class="kind"><SetTypeBadge type="drop" />{item.dropSets}</span>{/if}
        {#if item.failureSets}<span class="kind"><SetTypeBadge type="failure" />{item.failureSets}</span>{/if}
      </span>
    {/if}
  </span>
  <span class="vol"><b>{Math.round(item.totalVolume)}</b> kg</span>
</a>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 60px;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
    transition: background-color 160ms var(--ease);
  }
  .row:active {
    background: var(--surface-hi);
  }
  .ico {
    flex: none;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    color: var(--muted);
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }
  strong {
    font-weight: 600;
  }
  .meta {
    font-size: var(--t-sm);
  }
  .kcal {
    color: var(--ember);
  }
  .vol {
    color: var(--faint);
    font-size: var(--t-xs);
    white-space: nowrap;
  }
  .vol b {
    font-size: var(--t-base);
    font-weight: 600;
    color: var(--text);
  }
  .kinds {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.2rem;
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.05rem 0.4rem 0.05rem 0.15rem;
    border-radius: 6px;
    background: var(--surface-hi);
    font-size: var(--t-xs);
  }
</style>
