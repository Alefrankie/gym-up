<script lang="ts" generics="T extends string">
  import { cubicOut } from 'svelte/easing';
  import type { TransitionConfig } from 'svelte/transition';
  import Icon from './Icon.svelte';

  let {
    value = $bindable(),
    options,
    label,
    onchange,
  }: {
    value: T;
    options: { value: T; label: string }[];
    label?: string;
    onchange?: (value: T) => void;
  } = $props();

  /** Opens from the trigger: fades, drops a few pixels and settles from a slightly smaller size. */
  function pop(_node: Element, { duration = 200, out = false } = {}): TransitionConfig {
    return {
      duration,
      easing: cubicOut,
      css: (t) => `opacity: ${t}; transform: translateY(${(1 - t) * -8}px) scale(${0.97 + 0.03 * t}); transform-origin: top center;`,
    };
  }

  let open = $state(false);
  let root: HTMLElement;
  let active = $state(0);
  const uid = $props.id();

  const current = $derived(options.find((o) => o.value === value));

  function show() {
    active = Math.max(0, options.findIndex((o) => o.value === value));
    open = true;
  }

  function choose(o: { value: T }) {
    const changed = o.value !== value;
    value = o.value;
    open = false;
    if (changed) onchange?.(o.value);
  }

  function key(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') open = false;
    else if (e.key === 'ArrowDown') (e.preventDefault(), (active = Math.min(options.length - 1, active + 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), (active = Math.max(0, active - 1)));
    else if (e.key === 'Enter') (e.preventDefault(), choose(options[active]!));
  }

  // Keep the highlighted option in view while arrowing through a long list.
  $effect(() => {
    if (open) root?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  });
</script>

<svelte:window onpointerdown={(e) => open && !root.contains(e.target as Node) && (open = false)} />

<div class="select" bind:this={root}>
  <button
    type="button"
    class="trigger"
    class:open
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={`${uid}-list`}
    aria-label={label}
    onclick={() => (open ? (open = false) : show())}
    onkeydown={key}
  >
    <span class="value">{current?.label ?? ''}</span>
    <span class="chev"><Icon name="down" size={16} /></span>
  </button>
  {#if open}
    <ul id={`${uid}-list`} class="list" role="listbox" in:pop={{ duration: 220 }} out:pop={{ duration: 130 }}>
      {#each options as o, i (o.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          data-i={i}
          role="option"
          aria-selected={o.value === value}
          class:sel={o.value === value}
          class:hot={i === active}
          onpointerenter={() => (active = i)}
          onclick={(e) => (e.preventDefault(), choose(o))}
        >
          <span>{o.label}</span>
          {#if o.value === value}<Icon name="check" size={16} />{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .select {
    position: relative;
    min-width: 0;
  }
  .trigger {
    width: 100%;
    min-height: var(--control);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--text);
    font-weight: 400;
    text-align: left;
  }
  .trigger.open,
  .trigger:focus-visible {
    box-shadow: 0 0 0 1px var(--accent) inset;
    outline: none;
  }
  .value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chev {
    flex: none;
    display: grid;
    color: var(--muted);
    transition: transform 260ms var(--ease);
  }
  .open .chev {
    transform: rotate(180deg);
  }
  .list {
    position: absolute;
    z-index: 30;
    left: 0;
    right: 0;
    top: calc(100% + 0.35rem);
    max-height: 16rem;
    overflow-y: auto;
    margin: 0;
    padding: 0.3rem;
    list-style: none;
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
    overscroll-behavior: contain;
    will-change: transform, opacity;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 40px;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: var(--t-base);
    color: var(--text);
    cursor: pointer;
    transition: background-color 140ms var(--ease);
  }
  li.hot {
    background: var(--raised);
  }
  li.sel {
    color: var(--accent-hi);
    font-weight: 550;
  }
</style>
