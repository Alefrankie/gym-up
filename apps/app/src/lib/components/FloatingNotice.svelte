<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicIn, quintOut } from 'svelte/easing';

  let { children, ondismiss, placement = 'top' }: {
    children: Snippet;
    ondismiss?: () => void;
    placement?: 'top' | 'workout' | 'bottom' | 'update' | 'stacked';
  } = $props();

  let gesture: { id: number; startX: number } | null = null;
  let offset = $state(0);
  let exiting = $state(false);
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start(event: PointerEvent) {
    if (ondismiss && event.isPrimary && event.button === 0) {
      gesture = { id: event.pointerId, startX: event.clientX };
    }
  }

  function move(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (!gesture || gesture.id !== event.pointerId) return;
    offset = event.clientX - gesture.startX;
    if (Math.abs(offset) > 8 && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function reset() {
    gesture = null;
    if (!exiting) offset = 0;
  }

  function end(event: PointerEvent) {
    if (gesture?.id !== event.pointerId) return;
    const dismiss = Math.abs(offset) >= 88;
    if (dismiss && ondismiss) {
      exiting = true;
      gesture = null;
      ondismiss();
    } else reset();
  }
</script>

<div
  class="notice {placement}"
  role="group"
  class:swiping={offset !== 0}
  style:translate="{offset}px 0"
  onpointerdown={start}
  onpointermove={move}
  onpointerup={end}
  onpointercancel={reset}
  onlostpointercapture={(event) => {
    if (event.target === event.currentTarget) reset();
  }}
  onpointerleave={(event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) reset();
  }}
  in:fly|global={{ y: placement === 'bottom' ? 16 : -16, duration: reducedMotion() ? 0 : 340, easing: quintOut }}
  out:fly|global={{ x: exiting ? Math.sign(offset) * 96 : 0, y: exiting ? 0 : placement === 'bottom' ? 6 : -6, duration: reducedMotion() ? 0 : 220, easing: cubicIn }}
>
  {@render children()}
</div>

<style>
  .notice {
    position: fixed;
    z-index: 60;
    inset-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    top: calc(env(safe-area-inset-top) + 0.75rem);
    max-width: 28rem;
    margin-inline: auto;
    padding: 0.65rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--surface));
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 13%, var(--surface));
    box-shadow: var(--shadow-pop);
    color: var(--text);
    overflow-wrap: anywhere;
    touch-action: pan-y;
    transition: translate 180ms ease-out;
  }
  .workout { top: calc(env(safe-area-inset-top) + 3.25rem); }
  .bottom { top: auto; bottom: calc(5.2rem + env(safe-area-inset-bottom)); z-index: 40; }
  .update { z-index: 40; }
  .stacked { position: relative; inset: auto; max-width: none; margin: 0; }
  .swiping { transition: none; }
  @media (prefers-reduced-motion: reduce) {
    .notice { transition: none; }
  }
</style>
