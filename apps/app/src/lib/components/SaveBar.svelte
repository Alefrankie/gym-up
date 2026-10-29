<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';

  /**
   * The floating bottom action of an editor: "Guardar" while there are unsaved changes, a short "Guardado"
   * after saving, and otherwise whatever the screen's own action is (`idle`, e.g. "Empezar rutina").
   */
  let {
    dirty,
    saved,
    busy = false,
    disabled = false,
    label = 'Guardar cambios',
    onsave,
    idle,
  }: {
    dirty: boolean;
    saved: boolean;
    busy?: boolean;
    disabled?: boolean;
    label?: string;
    onsave: () => void;
    idle?: Snippet;
  } = $props();
</script>

{#if dirty || saved || idle}
  <div class="bar" transition:fly={{ y: 24, duration: 220, easing: cubicOut }}>
    {#if dirty}
      <button class="primary" disabled={busy || disabled} onclick={onsave}>{busy ? 'Guardando…' : label}</button>
    {:else}
      {#if saved}<span class="ok"><Icon name="check" size={16} /> Guardado</span>{/if}
      {@render idle?.()}
    {/if}
  </div>
{/if}

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    padding: 1.25rem 1rem calc(0.9rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    background: linear-gradient(180deg, transparent, var(--bg) 55%);
    pointer-events: none;
  }
  .bar > :global(*) {
    pointer-events: auto;
  }
  .ok {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--t-sm);
  }
  .bar :global(.primary) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    max-width: 16rem;
    margin: 0;
  }
</style>
