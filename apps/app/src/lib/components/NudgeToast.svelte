<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut, cubicIn } from 'svelte/easing';
  import { nudge } from '#lib/nudge.svelte';
</script>

{#if nudge.text}
  <button
    type="button"
    class="nudge"
    aria-live="polite"
    onclick={() => nudge.hide()}
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
  }
</style>
