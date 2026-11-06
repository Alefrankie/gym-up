<script lang="ts" generics="T">
  import { t } from '#lib/i18n';
  import { onMount, tick, type Snippet } from 'svelte';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';

  let {
    items,
    key,
    row,
    onreorder,
    onremove,
    onreplace,
    canRemove,
    reorderable = true,
    disabled = false,
    help,
    label,
  }: {
    items: T[];
    key: (item: T) => string;
    /** The third argument opens the row's Replace/Delete sheet; the row draws its own ⋮ button with it. */
    row: Snippet<[T, number, (() => void) | undefined]>;
    onreorder: (items: T[]) => void;
    /** Swipe right. */
    onremove?: (item: T) => void;
    /** Swipe left. */
    onreplace?: (item: T) => void;
    /** Rows that may be swiped away; all of them when omitted. */
    canRemove?: (item: T) => boolean;
    /** False for lists that only swipe (no hold-and-drag to reorder). */
    reorderable?: boolean;
    disabled?: boolean;
    /** Makes the swipe actions discoverable: a one-time peek of the first row, a ⋯ menu per row and a help line
     *  below the list until the person has swiped once. `id` keys what is remembered on this device. */
    help?: { id: string; text: string };
    /** Names a row in its ⋯ sheet title. */
    label?: (item: T) => string;
  } = $props();

  // The ⋯ sheet lives outside the rows: a row's transform would trap a fixed-position sheet inside it.
  let menuFor = $state<T | null>(null);
  function act(fn: ((item: T) => void) | undefined) {
    const item = menuFor;
    menuFor = null;
    if (item) fn?.(item);
  }

  const removable = (item: T) => !!onremove && (!canRemove || canRemove(item));
  const actionable = $derived(!disabled && (!!onremove || !!onreplace));
  const remembered = (name: string) => {
    try {
      return localStorage.getItem(`gymup.swipe.${name}.${help?.id}`) === '1';
    } catch {
      return false;
    }
  };
  const remember = (name: string) => {
    try {
      localStorage.setItem(`gymup.swipe.${name}.${help?.id}`, '1');
    } catch {
      /* storage unavailable: the hint just shows again next time */
    }
  };
  let swiped = $state(false);
  const showHelp = $derived(!!help && actionable && !swiped);

  // The peek: the first row slides open on its own, once per device, to show there is something underneath.
  let peekKey = $state<string | null>(null);
  let peekX = $state(0);
  $effect(() => {
    swiped = !help || remembered('used');
  });
  // Plain flag and timers on purpose: the effect re-runs while the peek moves the row, which must not cancel it.
  let peekStarted = false;
  const peekTimers: ReturnType<typeof setTimeout>[] = [];
  onMount(() => () => peekTimers.forEach(clearTimeout));
  $effect(() => {
    if (peekStarted || !help || !actionable || !items.length || remembered('peek')) return;
    peekStarted = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const first = items[0]!;
    const steps: [number, number][] = [
      [600, removable(first) ? 64 : 0],
      [1150, 0],
      [1450, onreplace ? -64 : 0],
      [2000, 0],
    ];
    remember('peek');
    for (const [at, x] of steps) peekTimers.push(setTimeout(() => ((peekKey = key(first)), (peekX = x)), at));
    peekTimers.push(setTimeout(() => (peekKey = null), 2300));
  });

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
    if (reorderable) g.timer = setTimeout(() => startDrag(k, startY), HOLD_MS);
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
      const item = find(g.key);
      const removable = !!onremove && (!canRemove || (item !== undefined && canRemove(item)));
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && ((dx > 0 && removable) || (dx < 0 && onreplace))) {
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
      if (item && Math.abs(x) > COMMIT && help) {
        swiped = true;
        remember('used');
      }
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
    {@const x = swipeKey === k ? swipeX : peekKey === k ? peekX : 0}
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
      ondragstart={(e) => e.preventDefault()}
    >
      {#if swipeKey === k || peekKey === k}
        <span class="act remove" class:on={x > COMMIT} style:opacity={x > 0 ? 1 : 0}><Icon name="trash" size={22} /> {t('plan.delete')}</span>
        <span class="act replace" class:on={x < -COMMIT} style:opacity={x < 0 ? 1 : 0}>{t('plan.replace')} <Icon name="swap" size={22} /></span>
      {/if}
      <div
        class="face"
        style:transform={dragKey === k ? `translateY(${dragY}px) scale(1.02)` : x ? `translateX(${x}px)` : undefined}
      >
        {@render row(item, i, help && actionable ? () => (menuFor = item) : undefined)}
      </div>
    </li>
  {/each}
</ul>
{#if showHelp}
  <p class="swipe-help">{help?.text}</p>
{/if}
{#if menuFor}
  <Sheet title={label?.(menuFor) ?? t('common.moreOptions')} onclose={() => (menuFor = null)}>
    <div class="actions">
      {#if onreplace}
        <button type="button" class="action" onclick={() => act(onreplace)}>
          <span class="glyph"><Icon name="swap" size={20} /></span>
          {t('plan.replace')}
        </button>
      {/if}
      {#if removable(menuFor)}
        <button type="button" class="action danger" onclick={() => act(onremove)}>
          <span class="glyph"><Icon name="trash" size={20} /></span>
          {t('plan.delete')}
        </button>
      {/if}
    </div>
  </Sheet>
{/if}

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
  /* Rows that are links (workout exercises): a long press must hold the row, not start the browser's link drag. */
  li :global(a) {
    -webkit-user-drag: none;
    -webkit-touch-callout: none;
  }
  .face {
    position: relative;
    will-change: transform;
    transition: transform 280ms var(--ease);
  }
  .actions {
    display: grid;
    gap: 0.5rem;
  }
  .action {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 56px;
    padding: 0 0.75rem;
    justify-content: flex-start;
    border-radius: var(--radius);
    background: var(--raised);
    box-shadow: none;
    color: var(--text);
    font-weight: 550;
  }
  .action:active {
    filter: brightness(1.15);
  }
  .glyph {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface);
  }
  .action.danger {
    color: var(--danger);
  }
  .swipe-help {
    margin: 0.75rem 0 0;
    font-size: var(--t-sm);
    color: var(--muted);
    text-align: center;
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
