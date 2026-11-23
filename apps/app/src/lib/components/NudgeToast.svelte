<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut, cubicIn } from 'svelte/easing';
  import { nudge } from '#lib/nudge.svelte';
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';

  let { workout = false }: { workout?: boolean } = $props();

  const DISMISS_DISTANCE = 88;
  let startX = $state<number | null>(null);
  let swipeX = $state(0);
  let suppressClick = false;

  function pointerDown(e: PointerEvent) {
    if (!e.isPrimary || e.button !== 0) return;
    suppressClick = false;
    startX = e.clientX;
    swipeX = 0;
    e.currentTarget instanceof HTMLElement && e.currentTarget.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: PointerEvent) {
    if (!e.isPrimary || startX === null) return;
    swipeX = e.clientX - startX;
  }

  function pointerUp(e: PointerEvent) {
    if (!e.isPrimary || startX === null) return;
    suppressClick = Math.abs(swipeX) > 8;
    const dismiss = Math.abs(swipeX) >= DISMISS_DISTANCE;
    startX = null;
    if (dismiss) nudge.hide();
    swipeX = 0;
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
    class:workout
    class:swiping={swipeX !== 0}
    aria-live="polite"
    style:translate="{swipeX}px 0"
    onclick={(e) => {
      if (workout && e.detail !== 0) return;
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
    in:fly={{ y: -24, duration: workout || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420, easing: backOut }}
    out:fly={{ y: -16, duration: workout || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180, easing: cubicIn }}
  >
    {#if workout}
      <span class="badge"><Icon name="bolt" size={18} /></span>
      <span class="message"><strong>{t('workout.coachNotice')}</strong><span>{nudge.text}</span></span>
    {:else}
      {nudge.text}
    {/if}
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
  .nudge.workout {
    top: calc(env(safe-area-inset-top) + 3.25rem);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--surface));
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 13%, var(--surface));
    color: var(--text);
    text-align: left;
  }
  .badge {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent-hi);
  }
  .message { display: grid; gap: 0.15rem; overflow-wrap: anywhere; }
  .message strong { color: var(--accent-hi); font-size: var(--t-xs); }
  @media (prefers-reduced-motion: reduce) {
    .nudge { transition: none; }
  }
</style>
