<script lang="ts">
  import type { RoutineExerciseDto } from '@gym-up/contracts';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import Icon from './Icon.svelte';
  import MuscleFigure from './MuscleFigure.svelte';

  let {
    ex,
    unit,
    href,
    progress,
  }: {
    ex: RoutineExerciseDto;
    unit: 'kg' | 'lbs';
    href?: string;
    /** Sets done out of total, when the workout is under way. */
    progress?: { done: number; total: number };
  } = $props();

  const finished = $derived(!!progress && progress.total > 0 && progress.done >= progress.total);
</script>

{#snippet inner()}
  <span class="tile">
    <MuscleFigure primary={ex.muscleGroup} secondary={ex.secondaryMuscles ?? []} size={30} />
  </span>
  <span class="body">
    <strong>{ex.exerciseName}</strong>
    <span class="meta">
      <Icon name="dumbbell" size={16} />
      {ex.targetSets} series · {ex.targetReps} reps{#if ex.last} · {toDisplay(ex.last.weight, unit)} {unit}{/if}
    </span>
  </span>
  {#if progress}
    <span class="prog" class:done={finished}>
      {#if finished}<Icon name="check" size={20} />{:else}{progress.done}/{progress.total}{/if}
    </span>
  {:else if href}
    <Icon name="right" size={20} />
  {/if}
{/snippet}

{#if href}
  <a class="row" {href}>{@render inner()}</a>
{:else}
  <div class="row">{@render inner()}</div>
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.55rem 0.8rem 0.55rem 0.55rem;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  a.row:active {
    transform: translateY(1px);
    box-shadow: var(--shadow-press);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 4rem;
    height: 5rem;
    border-radius: var(--radius-sm);
    background: radial-gradient(90% 70% at 50% 35%, rgb(255 106 43 / 0.14), transparent 70%), var(--bg);
    box-shadow: 0 2px 5px rgb(0 0 0 / 0.4) inset;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.25rem;
  }
  strong {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .prog {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 2.6rem;
    height: 2.6rem;
    padding: 0 0.5rem;
    border-radius: 999px;
    background: var(--bg);
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.4) inset;
    color: var(--muted);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.1rem;
  }
  .prog.done {
    background: linear-gradient(180deg, #a9dc83, var(--ok));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.4) inset;
    color: #12220a;
  }
</style>
