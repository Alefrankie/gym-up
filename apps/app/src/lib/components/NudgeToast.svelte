<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut, cubicIn } from 'svelte/easing';
  import { nudge } from '#lib/nudge.svelte';

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
    if (startX === null) return;
    swipeX = e.clientX - startX;
  }

  function pointerUp() {
    if (startX === null) return;
    suppressClick = Math.abs(swipeX) > 8;
    const dismiss = Math.abs(swipeX) >= DISMISS_DISTANCE;
    startX = null;
    if (dismiss) nudge.hide();
    else swipeX = 0;
  }

  function pointerCancel() {
    startX = null;
    swipeX = 0;
  }
</script>

{#if nudge.text}
  <button
    type="button"
    class="nudge"
    class:swiping={swipeX !== 0}
    aria-live="polite"
    style:translate="{swipeX}px 0"
    onclick={() => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      nudge.hide();
    }}
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerUp}
    onpointercancel={pointerCancel}
    in:fly={{ y: -24, duration: 420, easing: backOut }}
    out:fly={{ y: -16, duration: 180, easing: cubicIn }}
  >
    {nudge.text}
  </button>
{/if}

<style>
  .nudge {
    position: fixed;
    z-index: 60;
    top: calc(env(safe-area-inset-top) + 0.75rem);
    left: 1rem;
    right: 1rem;
    max-width: 28rem;
    margin: 0 auto;
    min-height: 48px;
    padding: 0.75rem 1rem;
    border-radius: 18px;
    background: var(--ember);
    box-shadow: var(--shadow-pop);
    color: #2a1700;
    font-weight: 650;
    text-align: center;
    line-height: 1.3;
    touch-action: pan-y;
    transition: translate 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .nudge.swiping { transition: none; }
</style>
