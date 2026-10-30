<script lang="ts">
  import { t } from '#lib/i18n';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { LibraryExerciseDto } from '@gym-up/contracts';
  import { equipment, muscle } from '#lib/labels';
  import Icon from './Icon.svelte';
  import MuscleFigure from './MuscleFigure.svelte';
  import ExerciseFilters from './ExerciseFilters.svelte';
  import { emptyFilter, filterExercises } from '#lib/exercise-filter';

  let {
    exercises,
    title,
    onpick,
    onclose,
  }: {
    exercises: LibraryExerciseDto[];
    title: string;
    onpick: (exercise: LibraryExerciseDto) => void;
    onclose: () => void;
  } = $props();

  let filter = $state(emptyFilter());
  const matches = $derived(filterExercises(exercises, filter).slice(0, 80));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="sheet" transition:fly={{ y: 40, duration: 300, easing: cubicOut }} role="dialog" aria-modal="true" aria-label={title}>
  <header>
    <h2>{title}</h2>
    <button class="icon ghost" onclick={onclose} aria-label={t('common.close')}><Icon name="x" size={18} /></button>
  </header>
  <ExerciseFilters bind:filter autofocus />
  <ul>
    {#each matches as ex (ex.id)}
      <li>
        <button class="pick" onclick={() => onpick(ex)}>
          <span class="tile"><MuscleFigure primary={ex.primaryMuscle} secondary={ex.secondaryMuscles} size={22} /></span>
          <span class="grow">
            <strong>{ex.name}</strong>
            <span class="muted">{muscle(ex.primaryMuscle)} · {equipment(ex.equipment)}</span>
          </span>
        </button>
      </li>
    {:else}
      <li class="muted empty">{t('library.noMatch')}</li>
    {/each}
  </ul>
</div>

<style>
  .sheet {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: calc(env(safe-area-inset-top) + 0.5rem) 1rem calc(1rem + env(safe-area-inset-bottom));
    background: var(--bg);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  header h2 {
    margin: 0.4rem 0;
    font-size: var(--t-lg);
  }
  ul {
    flex: 1;
    overflow-y: auto;
    list-style: none;
    margin: 0 -1rem;
    padding: 0.2rem 1rem;
    display: grid;
    gap: 0.4rem;
    align-content: start;
  }
  .pick {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.4rem 0.75rem 0.4rem 0.45rem;
    border-radius: var(--radius);
    background: var(--surface);
    text-align: left;
    font-weight: 400;
  }
  .pick:active:not(:disabled) {
    background: var(--surface-hi);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 44px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .grow {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .grow strong {
    font-weight: 550;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  .empty {
    padding: 1rem 0;
    font-size: var(--t-sm);
  }
</style>
