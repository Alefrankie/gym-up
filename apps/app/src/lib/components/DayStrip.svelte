<script lang="ts">
  import { t } from '#lib/i18n';
  /** Every day of the month containing `today` (YYYY-MM-DD), one small cell each: filled when taken, dimmed when still ahead. */
  let { days, today, label }: { days: string[]; today: string; label: string } = $props();

  const cells = $derived.by(() => {
    const on = new Set(days);
    const [y, m] = today.split('-').map(Number) as [number, number];
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const prefix = today.slice(0, 8);
    return Array.from({ length: count }, (_, i) => {
      const key = `${prefix}${String(i + 1).padStart(2, '0')}`;
      return { key, on: on.has(key), future: key > today };
    });
  });
  const total = $derived(cells.filter((c) => c.on).length);
</script>

<div class="strip" role="img" aria-label={t('supplements.stripLabel', { label, total, count: cells.length })}>
  {#each cells as c (c.key)}<span class:on={c.on} class:future={c.future} title={c.key}></span>{/each}
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
  span.future {
    opacity: 0.4;
  }
</style>
