<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';

  /**
   * The floating bottom action of an editor: the save button while there are unsaved changes, then the
   * button itself turns into a quick check (no "saved" caption), then the screen's own action (`idle`).
   */
  let {
    dirty,
    saved,
    busy = false,
    disabled = false,
    label = t('common.saveChanges'),
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

  // The check shows for a beat right after a save, then hands over to the idle action.
  let flash = $state(false);
  let wasSaved = false;
  $effect(() => {
    if (saved && !wasSaved && !dirty) {
      flash = true;
      navigator.vibrate?.(12);
      const t = setTimeout(() => (flash = false), 900);
      wasSaved = saved;
      return () => clearTimeout(t);
    }
    wasSaved = saved;
  });
</script>

{#if dirty || flash || idle}
  <div class="bar" transition:fly={{ y: 24, duration: 220, easing: cubicOut }}>
    {#if dirty}
      <!-- White, not orange: saving must never look like the screen's own action (e.g. "Start routine"). -->
      <button class="primary save" disabled={busy || disabled} onclick={onsave} in:fade={{ duration: 150 }}>
        {#if busy}<span class="spinner" aria-hidden="true"></span>{:else}<Icon name="check" size={18} />{/if}
        {busy ? t('common.saving') : label}
      </button>
    {:else if flash}
      <span class="done" role="status" aria-label={t('common.saved')} in:scale={{ start: 0.9, duration: 220, easing: cubicOut }}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      </span>
    {:else}
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
    /* Above the exercise screen too: unsaved set changes made there must stay one tap from saving. */
    z-index: 46;
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
  .done {
    display: grid;
    place-items: center;
    width: 100%;
    max-width: 16rem;
    min-height: 48px;
    border-radius: 999px;
    background: var(--ok);
    color: #0d1f07;
  }
  .done svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 24;
    stroke-dashoffset: 24;
    animation: draw 360ms 80ms var(--ease) forwards;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-right-color: transparent;
    animation: spin 700ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .save {
    background: var(--text);
    color: var(--bg);
  }
  .save:active:not(:disabled) {
    background: #ffffff;
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
