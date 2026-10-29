<script lang="ts">
  import type { RoutineExerciseDto, SetType } from '@gym-up/contracts';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import Icon from './Icon.svelte';
  import MuscleFigure from './MuscleFigure.svelte';
  import SetTypeBadge from './SetTypeBadge.svelte';

  let {
    ex,
    unit,
    href,
    onclick,
    progress,
    sets,
  }: {
    ex: RoutineExerciseDto;
    unit: 'kg' | 'lbs';
    href?: string;
    /** Makes the row a button (e.g. start the workout on this exercise). */
    onclick?: () => void;
    /** Sets done out of total, when the workout is under way. */
    progress?: { done: number; total: number };
    /** Logged sets to list under the name (summary of a workout). */
    sets?: { n: number; reps: number; weight: number; type: SetType }[];
  } = $props();

  const finished = $derived(!!progress && progress.total > 0 && progress.done >= progress.total);
</script>

{#snippet inner()}
  <span class="tile">
    <MuscleFigure primary={ex.muscleGroup} secondary={ex.secondaryMuscles ?? []} size={46} />
  </span>
  <span class="body">
    <strong>{ex.exerciseName}</strong>
    {#if sets?.length}
      <span class="sets">
        {#each sets as s (s.n)}
          <span class="set"><SetTypeBadge type={s.type} n={s.n} />{s.reps}×{s.weight}</span>
        {/each}
      </span>
    {:else}
      <span class="meta">
        <span class="setbars" aria-hidden="true">
          {#each Array.from({ length: Math.min(ex.targetSets, 5) }, (_, i) => i) as i (i)}<i></i>{/each}
        </span>
        {ex.targetSets} series · {ex.targetReps} reps{#if ex.last} · {toDisplay(ex.last.weight, unit)} {unit}{/if}
      </span>
    {/if}
  </span>
  {#if progress}
    <span class="prog" class:done={finished}>
      {#if finished}<Icon name="check" size={14} />{:else}{progress.done}/{progress.total}{/if}
    </span>
  {:else if href || onclick}
    <Icon name="right" size={18} />
  {/if}
{/snippet}

{#if href}
  <a class="row" {href}>{@render inner()}</a>
{:else if onclick}
  <button type="button" class="row" {onclick}>{@render inner()}</button>
{:else}
  <div class="row">{@render inner()}</div>
{/if}

<style>
  .setbars {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    height: 12px;
    margin-right: 0.15rem;
  }
  .setbars i {
    width: 3px;
    height: 12px;
    border-radius: 1px;
    background: var(--muted);
  }
  .sets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.15rem;
  }
  .set {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.1rem 0.4rem 0.1rem 0.15rem;
    border-radius: 6px;
    background: var(--surface-hi);
    color: var(--text);
    font-size: var(--t-xs);
    font-variant-numeric: tabular-nums;
  }
  button.row {
    width: 100%;
    box-shadow: none;
    background: none;
    padding: 0.25rem 0;
    font: inherit;
    text-align: left;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 88px;
    padding: 0.25rem 0;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    text-decoration: none;
    transition: background-color 160ms var(--ease);
  }
  a.row:active,
  button.row:active:not(:disabled) {
    background: var(--surface-hi);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 64px;
    height: 80px;
    border-radius: var(--radius);
    background: var(--surface-hi);
    overflow: hidden;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }
  strong {
    font-size: var(--t-base);
    font-weight: 550;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .row > :global(svg:last-child) {
    flex: none;
    color: var(--faint);
  }
  .prog {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 2.25rem;
    height: 1.75rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: var(--surface-hi);
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .prog.done {
    background: var(--ok);
    color: #12220a;
  }
</style>
