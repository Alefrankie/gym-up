<script lang="ts">
  import { t } from '#lib/i18n';
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon, { type IconName } from './Icon.svelte';

  /** A ⋯ button with a small menu of secondary actions (cancel, archive…). Destructive items go in red. */
  let {
    items,
    label = t('common.moreOptions'),
  }: { items: { label: string; icon: IconName; danger?: boolean; disabled?: boolean; onselect: () => void }[]; label?: string } = $props();

  let open = $state(false);
  let root: HTMLElement;
</script>

<svelte:window onpointerdown={(e) => open && !root.contains(e.target as Node) && (open = false)} />

<div class="overflow" bind:this={root}>
  <button type="button" class="more" aria-label={label} aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}>
    <Icon name="more" size={20} />
  </button>
  {#if open}
    <div class="menu" role="menu" transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }}>
      {#each items as it (it.label)}
        <button
          type="button"
          role="menuitem"
          class:danger={it.danger}
          disabled={it.disabled}
          onclick={() => {
            open = false;
            it.onselect();
          }}
        >
          <Icon name={it.icon} size={18} />
          {it.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .overflow {
    position: relative;
  }
  .more {
    width: 40px;
    min-height: 40px;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: none;
    box-shadow: none;
    color: var(--muted);
  }
  .menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 0.25rem);
    right: 0;
    padding: 0.3rem;
    display: grid;
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
    transform-origin: top right;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 0.75rem;
    background: none;
    box-shadow: none;
    color: var(--text);
    white-space: nowrap;
  }
  .menu button:active {
    background: var(--raised);
  }
  .menu button.danger {
    color: var(--danger);
  }
</style>
