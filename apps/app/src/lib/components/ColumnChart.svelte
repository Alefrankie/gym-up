<script lang="ts">
  /** Vertical columns with a label under each (workouts per week, volume per session…). The last column is "now". */
  let { values, labels, label }: { values: number[]; labels: string[]; label: string } = $props();
  const max = $derived(Math.max(1, ...values));
</script>

<div class="chart" role="img" aria-label={`${label}: ${values.join(', ')}`}>
  {#each values as v, i (i)}
    <div class="col">
      <span class="v">{v || ''}</span>
      <span class="bar" class:now={i === values.length - 1} style:height={`${Math.max(4, (v / max) * 100)}%`} class:zero={v === 0}></span>
      <span class="l">{labels[i]}</span>
    </div>
  {/each}
</div>

<style>
  .chart {
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
  .v,
  .l {
    font-size: var(--t-xs);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
