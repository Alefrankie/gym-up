<script lang="ts">
  import { t } from '#lib/i18n';
  /** Vertical columns with a label under each (workouts per week, volume per session…). The last column is "now". */
  let { values, labels, label, empty = t('common.noData') }: { values: number[]; labels: string[]; label: string; empty?: string } = $props();
  const max = $derived(Math.max(1, ...values));
  const isEmpty = $derived(values.every((v) => v === 0));
  // With nothing to show yet, faint example columns keep the shape of the chart instead of a blank box.
  const GHOST = [0.35, 0.55, 0.4, 0.7, 0.5, 0.8, 0.6, 0.9];
</script>

<div class="chart" class:empty={isEmpty} role="img" aria-label={isEmpty ? `${label}: ${empty}` : `${label}: ${values.join(', ')}`}>
  {#each values as v, i (i)}
    <div class="col">
      <span class="v">{isEmpty ? '' : v || ''}</span>
      <span
        class="bar"
        class:now={!isEmpty && i === values.length - 1}
        class:zero={!isEmpty && v === 0}
        class:ghost={isEmpty}
        style:height={isEmpty ? `${GHOST[i % GHOST.length]! * 100}%` : `${Math.max(4, (v / max) * 100)}%`}
      ></span>
      <span class="l">{labels[i]}</span>
    </div>
  {/each}
  {#if isEmpty}<p class="note">{empty}</p>{/if}
</div>

<style>
  .chart {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 6px;
    height: 9rem;
  }
  .col {
    flex: 1;
    display: grid;
    grid-template-rows: 1rem 1fr 1rem;
    justify-items: center;
    align-items: end;
    gap: 0.25rem;
    min-width: 0;
  }
  .bar {
    width: 100%;
    max-width: 22px;
    border-radius: 6px 6px 3px 3px;
    background: var(--raised);
    transition: height 400ms var(--ease);
  }
  .bar.now {
    background: var(--accent);
  }
  .bar.zero {
    background: var(--surface-hi);
  }
  .bar.ghost {
    background: var(--surface-hi);
    opacity: 0.55;
  }
  .note {
    position: absolute;
    inset: 0 0 1.4rem;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 0 1.5rem;
    text-align: center;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
    text-shadow: 0 1px 8px var(--surface);
  }
  .v,
  .l {
    font-size: 0.62rem;
    white-space: nowrap;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
