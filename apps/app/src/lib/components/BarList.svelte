<script lang="ts">
  /** Horizontal bars, longest first: a quick read of "how much of each" (sets per muscle, workouts per week…). */
  let { items, unit = '' }: { items: { label: string; value: number }[]; unit?: string } = $props();
  const max = $derived(Math.max(1, ...items.map((i) => i.value)));
</script>

<ul class="bars">
  {#each items as it (it.label)}
    <li>
      <span class="label">{it.label}</span>
      <span class="track"><span class="fill" style:width={`${(it.value / max) * 100}%`}></span></span>
      <span class="value">{it.value}{unit}</span>
    </li>
  {/each}
</ul>

<style>
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.55rem;
  }
  li {
    display: grid;
    grid-template-columns: 6.5rem 1fr 2.5rem;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--t-sm);
  }
  .label {
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .track {
    height: 10px;
    border-radius: 5px;
    background: var(--surface-hi);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 5px;
    background: var(--accent);
    transition: width 400ms var(--ease);
  }
  .value {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
