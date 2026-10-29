<script lang="ts">
  /** The last `count` days ending on `end` (YYYY-MM-DD), one small cell each, filled when the day is in `days`. */
  let { days, end, count = 30, label }: { days: string[]; end: string; count?: number; label: string } = $props();

  const cells = $derived.by(() => {
    const on = new Set(days);
    const last = new Date(`${end}T00:00:00Z`);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(last);
      d.setUTCDate(last.getUTCDate() - (count - 1 - i));
      const key = d.toISOString().slice(0, 10);
      return { key, on: on.has(key) };
    });
  });
  const total = $derived(cells.filter((c) => c.on).length);
</script>

<div class="strip" role="img" aria-label={`${label}: ${total} de los últimos ${count} días`}>
  {#each cells as c (c.key)}<span class:on={c.on} title={c.key}></span>{/each}
</div>

<style>
  .strip {
    display: flex;
    gap: 3px;
  }
  span {
    flex: 1;
    height: 18px;
    border-radius: 3px;
    background: var(--surface-hi);
  }
  span.on {
    background: var(--accent);
  }
</style>
