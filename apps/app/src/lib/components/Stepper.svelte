<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    label,
    value = $bindable(),
    min = 1,
    max = 100,
    onchange,
  }: { label: string; value: number; min?: number; max?: number; onchange?: () => void } = $props();

  function set(next: number) {
    value = Math.min(max, Math.max(min, next));
    onchange?.();
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <span class="label">{label}</span>
  <div class="ctl">
    <button type="button" class="icon" disabled={value <= min} onclick={() => set(value - 1)} aria-label={`Menos ${label.toLowerCase()}`}>
      <span class="bar" aria-hidden="true"></span>
    </button>
    <output aria-live="polite">{value}</output>
    <button type="button" class="icon" disabled={value >= max} onclick={() => set(value + 1)} aria-label={`Más ${label.toLowerCase()}`}>
      <Icon name="plus" size={20} />
    </button>
  </div>
</div>

<style>
  .stepper {
    display: grid;
    gap: 0.3rem;
    justify-items: center;
  }
  .label {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  output {
    min-width: 2.6rem;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.8rem;
  }
  .icon {
    border-radius: 50%;
  }
  .bar {
    width: 0.9rem;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
  }
</style>
