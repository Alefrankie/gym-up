<script lang="ts">
  import Icon from './Icon.svelte';
  import MuscleFigure from './MuscleFigure.svelte';

  /** A program at a glance: up to four of its most-trained muscles, each on its own small figure. */
  let { muscles = [], size = 64 }: { muscles?: string[]; size?: number } = $props();
  const shown = $derived(muscles.slice(0, 4));
</script>

<span class="thumb" class:solo={shown.length === 1} style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true">
  {#if shown.length === 0}
    <Icon name="dumbbell" size={Math.round(size / 2.6)} />
  {:else}
    {#each shown as m (m)}
      <span class="cell"><MuscleFigure primary={m} secondary={[]} size={shown.length === 1 ? size * 0.7 : size * 0.38} /></span>
    {/each}
  {/if}
</span>

<style>
  .thumb {
    flex: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    place-items: center;
    padding: 4px;
    border-radius: var(--radius);
    background: var(--surface-hi);
    color: var(--muted);
    overflow: hidden;
  }
  .thumb.solo,
  .thumb:has(> :global(svg)) {
    grid-template-columns: 1fr;
  }
  .cell {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
