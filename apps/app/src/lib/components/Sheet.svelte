<script lang="ts">
  import { t } from '#lib/i18n';
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';

  /** A bottom sheet over the screen: swipe it down, tap outside or the close button to dismiss. */
  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();

  let sheet = $state<HTMLDivElement>();
  let drag = $state(0);
  let dragging = $state(false);

  // Swipe down to close. Only starts when the sheet is scrolled to the top, so scrolling its content still works.
  // touchmove must be non-passive to stop the page from scrolling while dragging, hence addEventListener.
  $effect(() => {
    const el = sheet;
    if (!el) return;
    let startY = 0;
    let startAt = 0;
    let armed = false;
    const start = (e: TouchEvent) => {
      armed = el.scrollTop <= 0;
      startY = e.touches[0]!.clientY;
      startAt = performance.now();
    };
    const move = (e: TouchEvent) => {
      if (!armed) return;
      const dy = e.touches[0]!.clientY - startY;
      if (dy <= 0 && !dragging) return;
      if (!dragging && dy < 8) return;
      dragging = true;
      e.preventDefault();
      drag = Math.max(0, dy);
    };
    const end = () => {
      if (!dragging) return;
      const fast = drag / Math.max(1, performance.now() - startAt) > 0.6;
      const close = drag > el.offsetHeight * 0.3 || (fast && drag > 40);
      dragging = false;
      armed = false;
      if (close) onclose();
      else drag = 0;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="scrim" role="presentation" onclick={onclose} transition:fade={{ duration: 180 }}></div>
<div
  bind:this={sheet}
  class="sheet"
  class:settle={!dragging}
  style:transform={drag ? `translateY(${drag}px)` : null}
  role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: '100%', opacity: 1, duration: 260, easing: cubicOut }}>
  <span class="grip" aria-hidden="true"></span>
  <header>
    <h2>{title}</h2>
    <button type="button" class="icon ghost" aria-label={t('common.close')} onclick={onclose}><Icon name="x" size={20} /></button>
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
    will-change: transform;
  }
  .sheet.settle {
    transition: transform 220ms var(--ease);
  }
  .grip {
    display: block;
    width: 36px;
    height: 4px;
    margin: 0.25rem auto 0.75rem;
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
