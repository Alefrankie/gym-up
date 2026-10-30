<script lang="ts">
  import { t } from '#lib/i18n';

  /**
   * Monday-first weekday toggles. Values are 0 = Sunday … 6 = Saturday (like Date.getDay()).
   * `multiple` picks training days for a whole program; otherwise one day (or none) for a routine.
   */
  let {
    selected = $bindable([]),
    multiple = true,
    label,
    onchange,
  }: { selected: number[]; multiple?: boolean; label: string; onchange?: () => void } = $props();

  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const letters = $derived([...t('week.letters')]);

  function toggle(d: number) {
    if (multiple) selected = selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d];
    else selected = selected.includes(d) ? [] : [d];
    onchange?.();
  }
</script>

<div class="days" role="group" aria-label={label}>
  {#each ORDER as d, i (d)}
    <button type="button" class:on={selected.includes(d)} aria-pressed={selected.includes(d)} onclick={() => toggle(d)}>{letters[i]}</button>
  {/each}
</div>

<style>
  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.35rem;
  }
  button {
    min-height: 44px;
    padding: 0;
    font-weight: 600;
    border-radius: 999px;
  }
  button.on {
    background: var(--accent);
    color: var(--accent-ink);
    box-shadow: none;
  }
</style>
