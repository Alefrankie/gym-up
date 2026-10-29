<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';

  /** A bottom sheet over the screen: tap outside or the close button to dismiss. */
  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="scrim" role="presentation" onclick={onclose} transition:fade={{ duration: 180 }}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: 48, duration: 280, easing: cubicOut }}>
  <span class="grip" aria-hidden="true"></span>
  <header>
    <h2>{title}</h2>
    <button type="button" class="icon ghost" aria-label="Cerrar" onclick={onclose}><Icon name="x" size={20} /></button>
  </header>
  {@render children()}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 49;
    background: rgb(0 0 0 / 0.55);
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    max-height: 88dvh;
    overflow-y: auto;
    max-width: 34rem;
    margin: 0 auto;
    padding: 0.5rem 1rem calc(1.25rem + env(safe-area-inset-bottom));
    border-radius: 24px 24px 0 0;
    background: var(--surface);
    box-shadow: var(--shadow-pop);
  }
  .grip {
    display: block;
    width: 36px;
    height: 4px;
    margin: 0 auto 0.5rem;
    border-radius: 2px;
    background: var(--line-strong);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0.25rem 0 0.75rem;
  }
</style>
