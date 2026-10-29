<script lang="ts" generics="T">
  import { onMount, tick, type Snippet } from 'svelte';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';

  let {
    items,
    key,
    row,
    onreorder,
    onremove,
    onreplace,
    disabled = false,
  }: {
    items: T[];
    key: (item: T) => string;
    row: Snippet<[T, number]>;
    onreorder: (items: T[]) => void;
    /** Swipe right. */
    onremove?: (item: T) => void;
    /** Swipe left. */
    onreplace?: (item: T) => void;
    disabled?: boolean;
  } = $props();

  const HOLD_MS = 380;
  const SLOP = 9;
  const COMMIT = 96;

  let list: HTMLUListElement;
  const rowEls = new Map<string, HTMLElement>();

  // `working` is the order shown while a row is being dragged; outside a drag the rows follow `items`.
  let working = $state<T[]>([]);
  let dragKey = $state<string | null>(null);
  let dragY = $state(0);
  let swipeKey = $state<string | null>(null);
  let swipeX = $state(0);
  let suppressClick = false;

  type Gesture = { key: string; x0: number; y0: number; mode: 'wait' | 'swipe' | 'drag' | 'none'; grab: number; timer?: ReturnType<typeof setTimeout> };
  let g: Gesture | null = null;

  const shown = $derived(dragKey ? working : items);
  const find = (k: string) => items.find((i) => key(i) === k);

  // Touch scrolling must be blocked while a row is held or swiped; Svelte's own handlers are passive, so this one is manual.
  onMount(() => {
    const block = (e: TouchEvent) => {
      if (g && (g.mode === 'drag' || g.mode === 'swipe')) e.preventDefault();
    };
    list.addEventListener('touchmove', block, { passive: false });
    return () => list.removeEventListener('touchmove', block);
  });

  function reset() {
    if (g?.timer) clearTimeout(g.timer);
    g = null;
    dragKey = null;
    dragY = 0;
    swipeKey = null;
    swipeX = 0;
  }

  function down(e: PointerEvent, item: T) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as Element).closest('[data-nodrag]')) return;
    const k = key(item);
    g = { key: k, x0: e.clientX, y0: e.clientY, mode: 'wait', grab: 0 };
    const startY = e.clientY;
    g.timer = setTimeout(() => startDrag(k, startY), HOLD_MS);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* not an active pointer (synthetic event): the gesture still works through the element's own events */
    }
  }

  function startDrag(k: string, clientY: number) {
    if (!g || g.key !== k || g.mode !== 'wait') return;
    const el = rowEls.get(k);
    if (!el) return;
    g.mode = 'drag';
    g.grab = clientY - el.getBoundingClientRect().top;
    working = [...items];
    dragKey = k;
    dragY = 0;
    navigator.vibrate?.(18);
  }

  async function move(e: PointerEvent) {
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.mode === 'wait' && Math.hypot(dx, dy) > SLOP) {
      clearTimeout(g.timer);
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && ((dx > 0 && onremove) || (dx < 0 && onreplace))) {
        g.mode = 'swipe';
        swipeKey = g.key;
      } else {
        g.mode = 'none'; // a vertical scroll: leave it to the browser
      }
    }
    if (g.mode === 'swipe') {
      swipeX = Math.max(onreplace ? -140 : 0, Math.min(onremove ? 140 : 0, dx));
    } else if (g.mode === 'drag' && dragKey) {
      const el = rowEls.get(dragKey);
      if (!el) return;
      const rel = e.clientY - list.getBoundingClientRect().top;
      dragY = rel - g.grab - el.offsetTop;
      const center = rel - g.grab + el.offsetHeight / 2;
      const others = working.filter((i) => key(i) !== dragKey);
      const target = others.filter((i) => {
        const o = rowEls.get(key(i));
        return o ? o.offsetTop + o.offsetHeight / 2 < center : false;
      }).length;
      const current = working.findIndex((i) => key(i) === dragKey);
      if (target !== current) {
        const [moved] = working.splice(current, 1);
        working.splice(target, 0, moved!);
        navigator.vibrate?.(8);
        await tick(); // the row moved in the layout: recompute its offset so it does not jump
        const after = rowEls.get(dragKey ?? '');
        if (after) dragY = rel - g.grab - after.offsetTop;
      }
    }
  }

  function up() {
    if (!g) return;
    const { mode, key: k } = g;
    if (mode === 'swipe') {
      const item = find(k);
      const x = swipeX;
      suppressClick = true;
      reset();
      if (item && x > COMMIT) onremove?.(item);
      else if (item && x < -COMMIT) onreplace?.(item);
    } else if (mode === 'drag') {
      const next = working;
      const changed = next.some((i, n) => key(i) !== key(items[n]!));
      suppressClick = true;
      reset();
      if (changed) onreorder([...next]);
    } else {
      reset();
    }
    if (suppressClick) setTimeout(() => (suppressClick = false), 0);
  }
</script>

<ul bind:this={list} class="sortable">
  {#each shown as item, i (key(item))}
    {@const k = key(item)}
    <li
      bind:this={() => rowEls.get(k) ?? null, (el) => (el ? rowEls.set(k, el) : rowEls.delete(k))}
      animate:flip={{ duration: dragKey === k ? 0 : 240, easing: cubicOut }}
      class:dragging={dragKey === k}
      class:swiping={swipeKey === k}
      onpointerdown={(e) => down(e, item)}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={reset}
      onclickcapture={(e) => suppressClick && (e.stopPropagation(), e.preventDefault())}
      oncontextmenu={(e) => e.preventDefault()}
    >
      {#if swipeKey === k}
        <span class="act remove" class:on={swipeX > COMMIT} style:opacity={swipeX > 0 ? 1 : 0}><Icon name="trash" size={22} /> Eliminar</span>
        <span class="act replace" class:on={swipeX < -COMMIT} style:opacity={swipeX < 0 ? 1 : 0}>Reemplazar <Icon name="swap" size={22} /></span>
      {/if}
      <div
        class="face"
        style:transform={dragKey === k ? `translateY(${dragY}px) scale(1.02)` : swipeKey === k ? `translateX(${swipeX}px)` : undefined}
      >
        {@render row(item, i)}
      </div>
    </li>
  {/each}
</ul>

<style>
  .sortable {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    position: relative;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .face {
    position: relative;
    will-change: transform;
    transition: transform 280ms var(--ease);
  }
  li.swiping .face,
  li.dragging .face {
    transition: none;
  }
  /* A menu opened inside a row (set type) must sit above the rows below it. */
  li:focus-within {
    z-index: 6;
  }
  li.dragging {
    z-index: 5;
  }
  li.dragging .face {
    border-radius: var(--radius);
    box-shadow: var(--shadow-pop);
  }
  .act {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
    border-radius: var(--radius);
    font-size: var(--t-sm);
    font-weight: 550;
    color: var(--text);
    transition: filter 120ms;
    filter: saturate(0.6) brightness(0.8);
  }
  .act.on {
    filter: none;
  }
  .remove {
    justify-content: flex-start;
    background: var(--danger);
  }
  .replace {
    justify-content: flex-end;
    background: var(--raised);
    box-shadow: 0 0 0 1px var(--line-strong) inset;
  }
</style>
