<script lang="ts">
  import { t as tr } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let { message, onundo, ondismiss }: { message: string; onundo: () => void; ondismiss: () => void } = $props();

  onMount(() => {
    const t = setTimeout(ondismiss, 5000);
    return () => clearTimeout(t);
  });
</script>

<div class="toast" role="status" in:fly={{ y: 24, duration: 340, easing: cubicOut }} out:fade={{ duration: 160 }}>
  <span>{message}</span>
  <button type="button" onclick={onundo}>{tr('common.undo')}</button>
</div>

<style>
  .toast {
    position: fixed;
    left: 1rem;
    right: 1rem;
    bottom: calc(5.2rem + env(safe-area-inset-bottom));
    z-index: 40;
    max-width: 30rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.25rem 0.35rem 0.25rem 0.9rem;
    font-size: var(--t-sm);
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
  }
  button {
    min-height: 40px;
    padding: 0 0.7rem;
    font-size: var(--t-sm);
    font-weight: 600;
    background: none;
    box-shadow: none;
    color: var(--accent-hi);
  }
</style>
