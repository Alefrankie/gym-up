<script lang="ts">
  import type { SetType } from '@gym-up/contracts';
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { SET_TYPES, setTypeOf } from '#lib/set-types';
  import Icon from './Icon.svelte';
  import SetTypeBadge from './SetTypeBadge.svelte';

  /** The set-number cell of a set row: shows the number (or C/D/F) and opens a menu to change the kind of set. */
  let {
    n,
    type,
    disabled = false,
    onpick,
  }: { n: number; type: SetType | undefined; disabled?: boolean; onpick: (type: SetType) => void } = $props();

  let open = $state(false);
  let root: HTMLElement;
  const t = $derived(setTypeOf(type));

  function pick(v: SetType) {
    open = false;
    if (v !== t.value) onpick(v);
  }
</script>

<svelte:window onpointerdown={(e) => open && !root.contains(e.target as Node) && (open = false)} />

<div class="cell" bind:this={root}>
  <button
    type="button"
    class="n st-{t.value}"
    {disabled}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={`Serie ${n}: ${t.label}. Cambiar tipo`}
    onclick={() => (open = !open)}
  >{t.short || n}</button>
  {#if open}
    <div class="menu" role="menu" transition:scale={{ start: 0.96, duration: 160, easing: cubicOut }}>
      {#each SET_TYPES as o (o.value)}
        <button type="button" role="menuitemradio" aria-checked={o.value === t.value} class:sel={o.value === t.value} onclick={() => pick(o.value)}>
          <SetTypeBadge type={o.value} {n} size="md" />
          <span class="text"><strong>{o.label}</strong><small>{o.hint}</small></span>
          {#if o.value === t.value}<Icon name="check" size={16} />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cell {
    position: relative;
  }
  .n {
    width: 100%;
    min-height: 48px;
    padding: 0;
    background: var(--surface);
    font-weight: 600;
    color: var(--muted);
  }
  .menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.35rem);
    left: 0;
    width: 15.5rem;
    padding: 0.3rem;
    display: grid;
    gap: 0.1rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
    transform-origin: top left;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.35rem 0.5rem;
    background: none;
    box-shadow: none;
    text-align: left;
    color: var(--text);
  }
  .menu button.sel,
  .menu button:active {
    background: var(--raised);
  }
  .text {
    flex: 1;
    display: grid;
    line-height: 1.25;
  }
  .text strong {
    font-size: var(--t-base);
    font-weight: 550;
  }
  .text small {
    color: var(--muted);
    font-size: var(--t-xs);
  }
</style>
