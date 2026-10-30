<script lang="ts">
  import { EQUIPMENT } from '@gym-up/contracts';
  import { t } from '#lib/i18n';
  import { FILTER_MUSCLES, type ExerciseFilter } from '#lib/exercise-filter';
  import { equipment, muscle } from '#lib/labels';
  import Icon from './Icon.svelte';
  import MuscleFigure from './MuscleFigure.svelte';

  /** Search box plus muscle and equipment chips, shared by the library and the exercise picker. */
  let { filter = $bindable(), autofocus = false }: { filter: ExerciseFilter; autofocus?: boolean } = $props();

  let input = $state<HTMLInputElement>();
  $effect(() => {
    if (autofocus) input?.focus();
  });
</script>

<div class="filters">
  <label class="search">
    <Icon name="search" size={16} />
    <input bind:this={input} type="search" placeholder={t('library.search')} aria-label={t('library.search')} bind:value={filter.q} />
  </label>

  <div class="chips" role="group" aria-label={t('library.muscle')}>
    <button type="button" class="chip" class:on={!filter.muscle} aria-pressed={!filter.muscle} onclick={() => (filter.muscle = '')}>{t('programs.filterAll')}</button>
    {#each FILTER_MUSCLES as m (m)}
      <button type="button" class="chip" class:on={filter.muscle === m} aria-pressed={filter.muscle === m} onclick={() => (filter.muscle = filter.muscle === m ? '' : m)}>
        <MuscleFigure primary={m} size={14} />{muscle(m)}
      </button>
    {/each}
  </div>

  <div class="chips" role="group" aria-label={t('library.equipment')}>
    <button type="button" class="chip" class:on={!filter.equipment} aria-pressed={!filter.equipment} onclick={() => (filter.equipment = '')}>{t('library.allEquipment')}</button>
    {#each EQUIPMENT as e (e)}
      <button type="button" class="chip" class:on={filter.equipment === e} aria-pressed={filter.equipment === e} onclick={() => (filter.equipment = filter.equipment === e ? '' : e)}>
        {equipment(e)}
      </button>
    {/each}
  </div>
</div>

<style>
  .filters {
    display: grid;
    gap: 0.5rem;
  }
  .search {
    position: relative;
    display: flex;
    align-items: center;
    color: var(--faint);
  }
  .search :global(svg) {
    position: absolute;
    left: 0.85rem;
  }
  .search input {
    flex: 1;
    min-height: 44px;
    padding-left: 2.5rem;
    border-radius: 999px;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    margin: 0 -1rem;
    padding: 0 1rem;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chip {
    flex: none;
  }
</style>
