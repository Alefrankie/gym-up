<script lang="ts">
  import { t as tr } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let { message, onundo, ondismiss }: { message: string; onundo: () => void; ondismiss: () => void } = $props();
  const DISMISS_DISTANCE = 88;
  let startX = $state<number | null>(null);
  let swipeX = $state(0);
  let suppressClick = false;

  function pointerDown(e: PointerEvent) {
    if (!e.isPrimary) return;
    suppressClick = false;
    startX = e.clientX;
    swipeX = 0;
    e.currentTarget instanceof HTMLElement && e.currentTarget.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: PointerEvent) {
    if (startX !== null) swipeX = e.clientX - startX;
  }

  function pointerUp() {
    if (startX === null) return;
    suppressClick = Math.abs(swipeX) > 8;
    const dismiss = Math.abs(swipeX) >= DISMISS_DISTANCE;
    startX = null;
    if (dismiss) ondismiss();
    else swipeX = 0;
  }

  function pointerCancel() {
    startX = null;
    swipeX = 0;
    suppressClick = false;
  }

  function undo() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    onundo();
  }

  onMount(() => {
    const t = setTimeout(ondismiss, 5000);
    return () => clearTimeout(t);
  });
</script>

<div
  class="toast"
  class:swiping={swipeX !== 0}
  role="status"
  style:translate="{swipeX}px 0"
  onpointerdown={pointerDown}
  onpointermove={pointerMove}
  onpointerup={pointerUp}
  onpointercancel={pointerCancel}
  in:fly={{ y: 24, duration: 340, easing: cubicOut }}
  out:fade={{ duration: 160 }}
>
  <span>{message}</span>
  <button type="button" onclick={undo}>{tr('common.undo')}</button>
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
    touch-action: pan-y;
    transition: translate 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .toast.swiping { transition: none; }
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
