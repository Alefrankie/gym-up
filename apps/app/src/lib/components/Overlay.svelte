<script lang="ts" module>
  // Overlays can stack (an exercise, then how to do it): each one owns one history entry at its depth.
  let open = 0;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { pushState } from '$app/navigation';
  import { page } from '$app/state';
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';

  /**
   * A full screen over the current one with a back button. It takes a history entry, so the
   * system back gesture closes it and lands on the screen underneath instead of leaving the page.
   */
  let {
    title,
    onclose,
    zIndex = 45,
    trailing,
    children,
  }: { title: string; onclose: () => void; zIndex?: number; trailing?: Snippet; children: Snippet } = $props();

  const depth = ++open;
  let closed = false;
  let shown = false;

  onMount(() => pushState('', { overlay: depth }));

  // Back (gesture, button or Escape) pops our entry: the state underneath has a lower depth.
  $effect(() => {
    const current = (page.state as { overlay?: number }).overlay ?? 0;
    if (current >= depth) shown = true;
    else if (shown && !closed) {
      closed = true;
      onclose();
    }
  });

  onDestroy(() => {
    open--;
    // Closed by the page itself (e.g. after an action): drop the entry we pushed.
    if (!closed && ((page.state as { overlay?: number }).overlay ?? 0) >= depth) {
      closed = true;
      history.back();
    }
  });

  const back = () => history.back();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && depth === open && back()} />

<div class="screen" style:z-index={zIndex} role="dialog" aria-modal="true" aria-label={title} transition:fly={{ x: 40, duration: 260, easing: cubicOut }}>
  <header>
    <button type="button" class="round" aria-label={t('common.back')} onclick={back}><Icon name="left" size={20} /></button>
    <h1>{title}</h1>
    {#if trailing}{@render trailing()}{:else}<span></span>{/if}
  </header>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    background: var(--bg);
    padding: calc(env(safe-area-inset-top) + 0.5rem) 1rem calc(6rem + env(safe-area-inset-bottom));
  }
  header {
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  h1 {
    margin: 0;
    font-size: var(--t-lg);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .round {
    display: grid;
    place-items: center;
    width: 40px;
    min-height: 40px;
    padding: 0;
    border-radius: 50%;
    background: var(--surface);
  }
  .body {
    max-width: 34rem;
    margin: 0 auto;
  }
</style>
